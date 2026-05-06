import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AiService } from './ai.service.js';
import { AiJobsService } from './ai-jobs.service.js';
import {
  AIAction,
  EnumAiJobStatus,
  WakaSpecChapterContent,
  WakaSpecSubChapterContent,
  WakaSpecTemplateChapter,
} from '@prisma/client';
import { PROMPT_VERSION } from './prompts/suggest-questions.prompt.js';

// Erreur métier pour annulation volontaire
export class JobCancelledError extends Error {
  constructor(jobWid: string) {
    super(`Job ${jobWid} was cancelled`);
    this.name = 'JobCancelledError';
  }
}

// Grille tarifaire Anthropic Sonnet 4 : $3/M input, $15/M output
// estimatedCostCts = (inputTokens * 3 + outputTokens * 15) / 10_000
function computeCostCts(inputTokens: number, outputTokens: number): number {
  return Math.round((inputTokens * 3 + outputTokens * 15) / 10_000);
}

function classifyAnthropicError(error: unknown): string {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status: number }).status;
    if (status === 429) return 'ANTHROPIC_RATE_LIMIT';
    if (status >= 500) return 'ANTHROPIC_DOWN';
    if (status >= 400) return 'ANTHROPIC_INVALID_REQUEST';
  }
  const msg = error instanceof Error ? error.message : String(error);
  if (msg.includes('timeout') || msg.includes('ETIMEDOUT') || msg.includes('ECONNRESET')) {
    return 'ANTHROPIC_DOWN';
  }
  return 'INTERNAL';
}

// Shape intermédiaire retourné par ventilateSubChaptersForChapter
interface VentilatedSubChaptersResult {
  subChapters: Array<{
    wid: string;
    subChapterL1Wid: string;
    subChapterL2Wid: string;
    title: string;
    content: string | null;
    progress: number;
    order: number;
  }>;
  inputTokens: number;
  outputTokens: number;
}

// Type étendu pour le templateChapter avec ses sous-chapitres
type TemplateChapterWithSubChapters = WakaSpecTemplateChapter & {
  subChaptersL1: Array<{
    wid: string;
    title: string;
    order: number;
    subChaptersL2: Array<{ wid: string; title: string; order: number }>;
  }>;
};

@Processor('ai-jobs', { concurrency: 2 })
export class AiJobsProcessor extends WorkerHost {
  private readonly logger = new Logger(AiJobsProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
    private readonly aiJobsService: AiJobsService,
  ) {
    super();
  }

  async process(job: Job<{ jobWid?: string }>): Promise<void> {
    if (job.name === 'cleanup-stale-jobs') {
      this.logger.debug('Running stale jobs cleanup cron');
      await this.aiJobsService.cleanStaleJobs();
      return;
    }

    const { jobWid } = job.data;
    if (!jobWid) {
      this.logger.warn(`Job ${job.id} has no jobWid — skipping`);
      return;
    }
    this.logger.log(`Processing job ${jobWid} (name=${job.name})`);

    if (job.name === 'ventilate') {
      await this.processVentilate(jobWid);
    } else if (job.name === 'ventilate-subchapters') {
      await this.processVentilateSubChapters(jobWid);
    } else {
      this.logger.warn(`Unknown job name: ${job.name} — skipping`);
    }
  }

  private async processVentilate(jobWid: string): Promise<void> {
    // Charger le job depuis la DB
    const dbJob = await this.prisma.wakaSpecAiJob.findUnique({
      where: { wid: jobWid },
    });

    if (!dbJob) {
      this.logger.error(`Job ${jobWid} not found in DB — aborting`);
      return;
    }

    if (dbJob.status === EnumAiJobStatus.CANCELLED) {
      this.logger.log(`Job ${jobWid} already CANCELLED — aborting`);
      return;
    }

    // Marquer RUNNING
    await this.prisma.wakaSpecAiJob.update({
      where: { wid: jobWid },
      data: {
        status: EnumAiJobStatus.RUNNING,
        startedAt: new Date(),
      },
    });

    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    try {
      const input = dbJob.input as {
        specificationWid: string;
        initialText: string;
        userId: string;
      };

      // Charger la specification avec ses chapitres ET leurs sous-chapitres
      const specification = await this.prisma.wakaSpecification.findUnique({
        where: { wid: input.specificationWid },
        include: {
          template: {
            include: {
              chapters: {
                include: {
                  subChaptersL1: {
                    include: { subChaptersL2: true },
                    orderBy: { order: 'asc' },
                  },
                },
                orderBy: { order: 'asc' },
              },
            },
          },
          chapters: { orderBy: { chapterOrder: 'asc' } },
        },
      });

      if (!specification) {
        throw new Error(`Specification ${input.specificationWid} not found`);
      }

      const megaPrompt = specification.template.megaPrompt;
      const templateChapters = specification.template.chapters as unknown as TemplateChapterWithSubChapters[];
      const totalSteps = templateChapters.length;

      // Accumulateurs pour le result live
      const chapterResults: Array<{
        chapterWid: string;
        content: string;
        progress: number;
        isFilled: boolean;
      }> = [];
      const allSubChapterResults: Array<{
        wid: string;
        subChapterL1Wid: string;
        subChapterL2Wid: string;
        title: string;
        content: string | null;
        progress: number;
        order: number;
      }> = [];

      // Traitement séquentiel chapitre par chapitre pour mise à jour du progress
      for (let stepIndex = 0; stepIndex < templateChapters.length; stepIndex++) {
        const templateChapter = templateChapters[stepIndex];

        // Check annulation avant chaque appel Claude
        const freshJob = await this.prisma.wakaSpecAiJob.findUnique({
          where: { wid: jobWid },
          select: { status: true },
        });
        if (freshJob?.status === EnumAiJobStatus.CANCELLED) {
          throw new JobCancelledError(jobWid);
        }

        // Update progress avant l'appel
        await this.prisma.wakaSpecAiJob.update({
          where: { wid: jobWid },
          data: {
            progress: {
              currentStep: stepIndex + 1,
              totalSteps,
              currentChapterTitle: templateChapter.title,
              phase: 'chapter',
            },
          },
        });

        this.logger.debug(
          `Job ${jobWid}: step ${stepIndex + 1}/${totalSteps} — chapter "${templateChapter.title}"`,
        );

        // Appel Claude avec récupération des tokens
        const userMessage = `${templateChapter.prompt}\n\nVoici le texte initial à ventiler dans ce chapitre :\n\n<user_data>\n${input.initialText}\n</user_data>`;

        const { text, inputTokens, outputTokens } =
          await this.callClaudeWithTokens(megaPrompt, userMessage);

        totalInputTokens += inputTokens;
        totalOutputTokens += outputTokens;

        // Persister immédiatement le contenu du chapitre (résilience crash)
        let persistedChapterContentId: number;
        const chapterContent = specification.chapters.find(
          (ch: WakaSpecChapterContent) => ch.chapterWid === templateChapter.wid,
        );

        if (chapterContent) {
          await this.prisma.wakaSpecChapterContent.update({
            where: { id: chapterContent.id },
            data: { content: text, isFilled: text.trim().length >= 30 },
          });
          persistedChapterContentId = chapterContent.id;
        } else {
          // Cas defensif : la ligne WakaSpecChapterContent n'a pas ete pre-creee
          // a la creation de la spec (bug en amont). On la cree maintenant pour
          // ne PAS perdre silencieusement le contenu genere par Claude — sinon
          // le job termine SUCCEEDED mais l'editeur reste vide cote frontend
          // (et le user a paye des tokens pour rien).
          this.logger.warn(
            `Job ${jobWid}: chapterContent missing for chapterWid=${templateChapter.wid} — creating fallback row`,
          );
          const created = await this.prisma.wakaSpecChapterContent.create({
            data: {
              specificationId: specification.id,
              chapterWid: templateChapter.wid,
              chapterTitle: templateChapter.title,
              chapterOrder: templateChapter.order,
              content: text,
              isFilled: text.trim().length >= 30,
            },
          });
          persistedChapterContentId = created.id;
        }

        // Créer l'entrée dans l'historique AI
        await this.prisma.wakaSpecAIHistory.create({
          data: {
            specificationId: specification.id,
            chapterWid: templateChapter.wid,
            action: AIAction.VENTILATE,
            userInstruction: input.initialText,
            aiResponse: text,
            userId: input.userId,
            modelUsed: this.aiService.model,
            megaPromptSnapshot: megaPrompt,
            chapterPromptSnapshot: templateChapter.prompt,
            promptVersion: PROMPT_VERSION,
          },
        });

        // Ajouter aux résultats de chapitres
        const isFilled = text.trim().length >= 30;
        chapterResults.push({
          chapterWid: templateChapter.wid,
          content: text,
          progress: Math.min(80, Math.round(text.length / 50)),
          isFilled,
        });

        // Ventiler les sous-chapitres si le template en a
        if (templateChapter.subChaptersL1.length > 0) {
          // Update progress pour indiquer la phase sous-chapitres
          await this.prisma.wakaSpecAiJob.update({
            where: { wid: jobWid },
            data: {
              progress: {
                currentStep: stepIndex + 1,
                totalSteps,
                currentChapterTitle: templateChapter.title,
                phase: 'subchapters',
              },
            },
          });

          const subResult = await this.ventilateSubChaptersForChapter({
            specificationId: specification.id,
            chapterContentId: persistedChapterContentId,
            chapterWid: templateChapter.wid,
            chapterTitle: templateChapter.title,
            parentContent: text,
            templateChapter,
            megaPrompt,
            userId: input.userId,
            jobWid,
          });

          totalInputTokens += subResult.inputTokens;
          totalOutputTokens += subResult.outputTokens;
          allSubChapterResults.push(...subResult.subChapters);
        }

        // Mise à jour du result live (chapitres + sous-chapitres au fil de l'eau)
        const filledCount = chapterResults.filter((c) => c.isFilled).length;
        await this.prisma.wakaSpecAiJob.update({
          where: { wid: jobWid },
          data: {
            result: {
              chapters: chapterResults,
              subChapters: allSubChapterResults,
              progress: {
                filled: filledCount,
                total: totalSteps,
                percent: Math.round((filledCount / totalSteps) * 100),
              },
            },
          },
        });
      }

      // Recalcul progression globale de la spec
      await this.recalculateProgress(specification.id);

      // Calcul du coût estimé
      const estimatedCostCts = computeCostCts(totalInputTokens, totalOutputTokens);

      const filledCountFinal = chapterResults.filter((c) => c.isFilled).length;

      // Marquer SUCCEEDED
      await this.prisma.wakaSpecAiJob.update({
        where: { wid: jobWid },
        data: {
          status: EnumAiJobStatus.SUCCEEDED,
          finishedAt: new Date(),
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
          estimatedCostCts,
          result: {
            chapters: chapterResults,
            subChapters: allSubChapterResults,
            progress: {
              filled: filledCountFinal,
              total: totalSteps,
              percent: Math.round((filledCountFinal / totalSteps) * 100),
            },
          },
          progress: {
            currentStep: totalSteps,
            totalSteps,
            currentChapterTitle: null,
            phase: 'done',
          },
        },
      });

      this.logger.log(
        `Job ${jobWid}: SUCCEEDED — ${totalSteps} chapters, ${allSubChapterResults.length} sub-chapters, ${totalInputTokens} input tokens, ${totalOutputTokens} output tokens, ~${estimatedCostCts}cts`,
      );
    } catch (error) {
      if (error instanceof JobCancelledError) {
        await this.prisma.wakaSpecAiJob.update({
          where: { wid: jobWid },
          data: {
            status: EnumAiJobStatus.CANCELLED,
            finishedAt: new Date(),
            inputTokens: totalInputTokens,
            outputTokens: totalOutputTokens,
          },
        });
        this.logger.log(`Job ${jobWid}: CANCELLED during processing`);
        return;
      }

      const errorCode = classifyAnthropicError(error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      await this.prisma.wakaSpecAiJob.update({
        where: { wid: jobWid },
        data: {
          status: EnumAiJobStatus.FAILED,
          finishedAt: new Date(),
          errorCode,
          errorMessage,
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
        },
      });

      this.logger.error(
        `Job ${jobWid}: FAILED — errorCode=${errorCode} error=${errorMessage}`,
      );

      // Rethrow pour que BullMQ logge l'erreur
      throw error;
    }
  }

  private async processVentilateSubChapters(jobWid: string): Promise<void> {
    const dbJob = await this.prisma.wakaSpecAiJob.findUnique({
      where: { wid: jobWid },
    });

    if (!dbJob) {
      this.logger.error(`Job ${jobWid} not found in DB — aborting`);
      return;
    }

    if (dbJob.status === EnumAiJobStatus.CANCELLED) {
      this.logger.log(`Job ${jobWid} already CANCELLED — aborting`);
      return;
    }

    await this.prisma.wakaSpecAiJob.update({
      where: { wid: jobWid },
      data: { status: EnumAiJobStatus.RUNNING, startedAt: new Date() },
    });

    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    try {
      const input = dbJob.input as {
        specificationWid: string;
        chapterWid: string;
        chapterContentId: number;
        userId: string;
      };

      // Charger la spec avec template sous-chapitres et le contenu du chapitre parent
      const specification = await this.prisma.wakaSpecification.findUnique({
        where: { wid: input.specificationWid },
        include: {
          template: {
            include: {
              chapters: {
                include: {
                  subChaptersL1: {
                    include: { subChaptersL2: true },
                    orderBy: { order: 'asc' },
                  },
                },
                orderBy: { order: 'asc' },
              },
            },
          },
        },
      });

      if (!specification) {
        throw new Error(`Specification ${input.specificationWid} not found`);
      }

      const chapterContent = await this.prisma.wakaSpecChapterContent.findUnique({
        where: { id: input.chapterContentId },
      });

      if (!chapterContent) {
        throw new Error(`ChapterContent ${input.chapterContentId} not found`);
      }

      const templateChapter = (specification.template.chapters as unknown as TemplateChapterWithSubChapters[]).find(
        (ch) => ch.wid === input.chapterWid,
      );

      if (!templateChapter || templateChapter.subChaptersL1.length === 0) {
        throw new Error(
          `Template chapter ${input.chapterWid} has no sub-chapters to ventilate into`,
        );
      }

      const megaPrompt = specification.template.megaPrompt;
      const parentContent = chapterContent.content ?? '';

      // Check annulation avant l'appel Claude
      const freshJob = await this.prisma.wakaSpecAiJob.findUnique({
        where: { wid: jobWid },
        select: { status: true },
      });
      if (freshJob?.status === EnumAiJobStatus.CANCELLED) {
        throw new JobCancelledError(jobWid);
      }

      const totalSteps = templateChapter.subChaptersL1.reduce(
        (acc, l1) => acc + Math.max(1, l1.subChaptersL2.length),
        0,
      );

      await this.prisma.wakaSpecAiJob.update({
        where: { wid: jobWid },
        data: {
          progress: { currentStep: 0, totalSteps, phase: 'ventilation' },
        },
      });

      const subResult = await this.ventilateSubChaptersForChapter({
        specificationId: specification.id,
        chapterContentId: input.chapterContentId,
        chapterWid: input.chapterWid,
        chapterTitle: chapterContent.chapterTitle,
        parentContent,
        templateChapter,
        megaPrompt,
        userId: input.userId,
        jobWid,
      });

      totalInputTokens += subResult.inputTokens;
      totalOutputTokens += subResult.outputTokens;

      // Mise à jour progress final du job au fil de la persistance
      await this.prisma.wakaSpecAiJob.update({
        where: { wid: jobWid },
        data: {
          progress: {
            currentStep: totalSteps,
            totalSteps,
            phase: 'persist',
          },
        },
      });

      // Recalcul progression globale
      await this.recalculateProgress(specification.id);

      const estimatedCostCts = computeCostCts(totalInputTokens, totalOutputTokens);

      await this.prisma.wakaSpecAiJob.update({
        where: { wid: jobWid },
        data: {
          status: EnumAiJobStatus.SUCCEEDED,
          finishedAt: new Date(),
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
          estimatedCostCts,
          progress: { currentStep: totalSteps, totalSteps, phase: 'done' },
          result: {
            subChapters: subResult.subChapters,
          },
        },
      });

      this.logger.log(
        `Job ${jobWid}: VENTILATE_SUBCHAPTERS SUCCEEDED — ${subResult.subChapters.length} sub-chapters, ${totalInputTokens} in, ${totalOutputTokens} out, ~${estimatedCostCts}cts`,
      );
    } catch (error) {
      if (error instanceof JobCancelledError) {
        await this.prisma.wakaSpecAiJob.update({
          where: { wid: jobWid },
          data: {
            status: EnumAiJobStatus.CANCELLED,
            finishedAt: new Date(),
            inputTokens: totalInputTokens,
            outputTokens: totalOutputTokens,
          },
        });
        this.logger.log(`Job ${jobWid}: CANCELLED during processVentilateSubChapters`);
        return;
      }

      const errorCode = classifyAnthropicError(error);
      const errorMessage = error instanceof Error ? error.message : String(error);

      await this.prisma.wakaSpecAiJob.update({
        where: { wid: jobWid },
        data: {
          status: EnumAiJobStatus.FAILED,
          finishedAt: new Date(),
          errorCode,
          errorMessage,
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
        },
      });

      this.logger.error(
        `Job ${jobWid}: VENTILATE_SUBCHAPTERS FAILED — errorCode=${errorCode} error=${errorMessage}`,
      );
      throw error;
    }
  }

  /**
   * Ventile le contenu d'un chapitre parent dans ses sous-chapitres L1/L2.
   * Méthode extraite pour être réutilisée dans processVentilate (cascade)
   * et processVentilateSubChapters (job dédié).
   * Ne gère PAS le cycle de vie du job (status, SUCCEEDED/FAILED).
   */
  private async ventilateSubChaptersForChapter(params: {
    specificationId: number;
    chapterContentId: number;
    chapterWid: string;
    chapterTitle: string;
    parentContent: string;
    templateChapter: TemplateChapterWithSubChapters;
    megaPrompt: string;
    userId: string;
    jobWid: string;
  }): Promise<VentilatedSubChaptersResult> {
    const {
      specificationId,
      chapterContentId,
      chapterTitle,
      parentContent,
      templateChapter,
      megaPrompt,
      userId,
      jobWid,
    } = params;

    // Construire la liste à plat des sous-chapitres à extraire
    // Format : [ { l1Wid, l2Wid|'', title, order } ]
    // subChapterL2Wid utilise '' (non-null) quand il n'y a pas de niveau L2
    // afin de garantir l'unicité composite en PostgreSQL
    const subChapterSlots: Array<{
      l1Wid: string;
      l2Wid: string;
      title: string;
      order: number;
    }> = [];

    let orderIndex = 0;
    for (const l1 of templateChapter.subChaptersL1) {
      if (l1.subChaptersL2.length === 0) {
        subChapterSlots.push({
          l1Wid: l1.wid,
          l2Wid: '',
          title: l1.title,
          order: orderIndex++,
        });
      } else {
        for (const l2 of l1.subChaptersL2) {
          subChapterSlots.push({
            l1Wid: l1.wid,
            l2Wid: l2.wid,
            title: `${l1.title} — ${l2.title}`,
            order: orderIndex++,
          });
        }
      }
    }

    const totalSteps = subChapterSlots.length;

    // Construire le prompt de ventilation
    const subChapterList = subChapterSlots
      .map((s, i) => `${i + 1}. ${s.title}`)
      .join('\n');

    const systemPrompt = `${megaPrompt}\n\nTu es un expert en rédaction de spécifications fonctionnelles. Tu dois ventiler le contenu d'un chapitre parent en sections distinctes correspondant aux sous-chapitres attendus du template.`;

    const userMessage = `Voici le contenu du chapitre "${chapterTitle}" à ventiler :\n\n<contenu_parent>\n${parentContent}\n</contenu_parent>\n\nSous-chapitres attendus (un bloc JSON par sous-chapitre) :\n${subChapterList}\n\nRetourne UNIQUEMENT un tableau JSON valide (sans texte autour) de la forme :\n[\n  { "index": 1, "content": "..." },\n  { "index": 2, "content": "..." }\n]\n\nChaque "content" doit contenir le texte extrait et reformulé du chapitre parent correspondant au sous-chapitre. Si le contenu parent ne couvre pas un sous-chapitre, laisse "content" vide ("").`;

    // Appel Claude unique pour ventiler tout le contenu d'un coup
    const { text, inputTokens, outputTokens } = await this.callClaudeWithTokens(
      systemPrompt,
      userMessage,
    );

    // Parser la réponse JSON
    let ventilatedContent: Array<{ index: number; content: string }> = [];
    try {
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        ventilatedContent = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      this.logger.error(
        `Job ${jobWid}: failed to parse sub-chapter ventilation JSON — raw: ${text.slice(0, 500)}`,
      );
      throw new Error(`Failed to parse sub-chapter ventilation response: ${parseError}`);
    }

    // Persister les sous-chapitres au fil de l'eau (UPSERT)
    const persistedSubChapters: WakaSpecSubChapterContent[] = [];

    for (let i = 0; i < subChapterSlots.length; i++) {
      const slot = subChapterSlots[i];
      const ventilated = ventilatedContent.find((v) => v.index === i + 1);
      const subContent = ventilated?.content?.trim() ?? '';

      const progress = subContent.length === 0
        ? 0
        : subContent.length < 50
          ? 5
          : Math.min(80, Math.round(subContent.length / 50));

      const upserted = await this.prisma.wakaSpecSubChapterContent.upsert({
        where: {
          chapterContentId_subChapterL1Wid_subChapterL2Wid: {
            chapterContentId,
            subChapterL1Wid: slot.l1Wid,
            subChapterL2Wid: slot.l2Wid,
          },
        },
        create: {
          specificationId,
          chapterContentId,
          subChapterL1Wid: slot.l1Wid,
          subChapterL2Wid: slot.l2Wid,
          title: slot.title,
          content: subContent || null,
          progress,
          order: slot.order,
        },
        update: {
          title: slot.title,
          content: subContent || null,
          progress,
        },
      });

      persistedSubChapters.push(upserted);
    }

    // Log d'historique IA (un seul log par chapitre parent)
    await this.prisma.wakaSpecAIHistory.create({
      data: {
        specificationId,
        chapterWid: params.chapterWid,
        action: AIAction.VENTILATE,
        userInstruction: `Ventilation en ${totalSteps} sous-chapitres`,
        aiResponse: text,
        userId,
        modelUsed: this.aiService.model,
        megaPromptSnapshot: megaPrompt,
        chapterPromptSnapshot: templateChapter.prompt,
        promptVersion: PROMPT_VERSION,
      },
    });

    this.logger.debug(
      `Job ${jobWid}: ventilated ${persistedSubChapters.length} sub-chapters for chapter "${chapterTitle}"`,
    );

    return {
      subChapters: persistedSubChapters.map((sc) => ({
        wid: sc.wid,
        subChapterL1Wid: sc.subChapterL1Wid,
        subChapterL2Wid: sc.subChapterL2Wid,
        title: sc.title,
        content: sc.content,
        progress: sc.progress,
        order: sc.order,
      })),
      inputTokens,
      outputTokens,
    };
  }

  private async recalculateProgress(specificationId: number): Promise<void> {
    const chapters = await this.prisma.wakaSpecChapterContent.findMany({
      where: { specificationId },
    });
    const total = chapters.length;
    const sum = chapters.reduce((acc, ch) => acc + ch.progress, 0);
    const globalProgress = total > 0 ? Math.round(sum / total) : 0;
    await this.prisma.wakaSpecification.update({
      where: { id: specificationId },
      data: { globalProgress },
    });
  }

  private async callClaudeWithTokens(
    system: string,
    userMessage: string,
  ): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
    const anthropic = this.aiService.anthropic;
    const model = this.aiService.model;

    const systemParam = [
      {
        type: 'text' as const,
        text: system,
        cache_control: { type: 'ephemeral' as const },
      },
    ] as Anthropic.MessageCreateParamsNonStreaming['system'];

    const response = await anthropic.messages.create({
      model,
      max_tokens: 8192,
      system: systemParam,
      messages: [{ role: 'user', content: userMessage }],
    });

    if (response.stop_reason === 'max_tokens') {
      this.logger.warn(`callClaudeWithTokens: response truncated (max_tokens) — model=${model}`);
    }

    const textBlock = response.content.find(
      (b: Anthropic.ContentBlock): b is Anthropic.TextBlock => b.type === 'text',
    );

    return {
      text: textBlock?.text ?? '',
      inputTokens: response.usage?.input_tokens ?? 0,
      outputTokens: response.usage?.output_tokens ?? 0,
    };
  }
}
