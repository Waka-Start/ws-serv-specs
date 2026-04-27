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

      // Charger la specification avec ses chapitres
      const specification = await this.prisma.wakaSpecification.findUnique({
        where: { wid: input.specificationWid },
        include: {
          template: {
            include: {
              chapters: { orderBy: { order: 'asc' } },
            },
          },
          chapters: { orderBy: { chapterOrder: 'asc' } },
        },
      });

      if (!specification) {
        throw new Error(`Specification ${input.specificationWid} not found`);
      }

      const megaPrompt = specification.template.megaPrompt;
      const templateChapters = specification.template.chapters;
      const totalSteps = templateChapters.length;
      const chapterResults: Array<{ chapterWid: string; content: string }> = [];

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
        const chapterContent = specification.chapters.find(
          (ch: WakaSpecChapterContent) => ch.chapterWid === templateChapter.wid,
        );

        if (chapterContent) {
          await this.prisma.wakaSpecChapterContent.update({
            where: { id: chapterContent.id },
            data: { content: text },
          });
        } else {
          this.logger.warn(
            `Job ${jobWid}: chapterContent not found for chapterWid=${templateChapter.wid}`,
          );
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

        chapterResults.push({ chapterWid: templateChapter.wid, content: text });
      }

      // Calcul du coût estimé
      const estimatedCostCts = computeCostCts(totalInputTokens, totalOutputTokens);

      // Marquer SUCCEEDED
      await this.prisma.wakaSpecAiJob.update({
        where: { wid: jobWid },
        data: {
          status: EnumAiJobStatus.SUCCEEDED,
          finishedAt: new Date(),
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
          estimatedCostCts,
          result: { chapters: chapterResults },
          progress: {
            currentStep: totalSteps,
            totalSteps,
            currentChapterTitle: null,
          },
        },
      });

      this.logger.log(
        `Job ${jobWid}: SUCCEEDED — ${totalSteps} chapters, ${totalInputTokens} input tokens, ${totalOutputTokens} output tokens, ~${estimatedCostCts}cts`,
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
