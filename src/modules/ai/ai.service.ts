import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service.js';
import Anthropic from '@anthropic-ai/sdk';
import { AIAction } from '@prisma/client';
import { VentilateDto } from './dto/ventilate.dto.js';
import { GenerateChapterDto } from './dto/generate-chapter.dto.js';
import { ModifyContentDto } from './dto/modify-content.dto.js';
import { DeleteContentDto } from './dto/delete-content.dto.js';
import { TestPromptDto } from './dto/test-prompt.dto.js';
import {
  SuggestQuestionsDto,
  SuggestedQuestion,
} from './dto/suggest-questions.dto.js';
import {
  EvaluateChapterDto,
  EvaluateAllChaptersDto,
  ChapterEvaluationDetails,
} from './dto/evaluate-chapter.dto.js';
import {
  MODIFY_CONTENT_SYSTEM,
  buildModifyContentUserMessage,
} from './prompts/modify-content.prompt.js';
import {
  SUGGEST_QUESTIONS_SYSTEM,
  buildSuggestQuestionsUserMessage,
  PROMPT_VERSION,
} from './prompts/suggest-questions.prompt.js';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly anthropic: Anthropic;
  private readonly model: string;
  private readonly modelLight: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.anthropic = new Anthropic({
      apiKey: this.configService.get<string>('ANTHROPIC_API_KEY'),
    });
    this.model = this.configService.get<string>(
      'ANTHROPIC_MODEL',
      'claude-sonnet-4-20250514',
    );
    // Backward compat : ANTHROPIC_EVAL_MODEL deprecated en faveur de ANTHROPIC_MODEL_LIGHT
    const deprecatedEvalModel = this.configService.get<string>('ANTHROPIC_EVAL_MODEL');
    if (deprecatedEvalModel) {
      this.logger.warn('ANTHROPIC_EVAL_MODEL is deprecated, use ANTHROPIC_MODEL_LIGHT instead');
    }
    this.modelLight = this.configService.get<string>(
      'ANTHROPIC_MODEL_LIGHT',
      deprecatedEvalModel ?? 'claude-haiku-4-5-20251001',
    );
  }

  async ventilate(dto: VentilateDto) {
    const specification = await this.prisma.wakaSpecification.findUnique({
      where: { wid: dto.specificationWid },
      include: {
        template: {
          include: {
            chapters: {
              orderBy: { order: 'asc' },
            },
          },
        },
        chapters: {
          orderBy: { chapterOrder: 'asc' },
        },
      },
    });

    if (!specification) {
      throw new NotFoundException(
        `Specification ${dto.specificationWid} not found`,
      );
    }

    const megaPrompt = specification.template.megaPrompt;
    const templateChapters = specification.template.chapters;

    // Concurrence bornée à 3 appels simultanés pour éviter la saturation de l'API
    const CONCURRENCY_LIMIT = 3;
    const results: Array<{
      templateChapter: (typeof templateChapters)[0];
      aiResponse: string;
    }> = [];

    for (let i = 0; i < templateChapters.length; i += CONCURRENCY_LIMIT) {
      const batch = templateChapters.slice(i, i + CONCURRENCY_LIMIT);
      const batchResults = await Promise.all(
        batch.map(async (templateChapter) => {
          const userMessage = `${templateChapter.prompt}\n\nVoici le texte initial à ventiler dans ce chapitre :\n\n<user_data>\n${dto.initialText}\n</user_data>`;
          const aiResponse = await this.callClaude(megaPrompt, userMessage, {
            enableCache: true,
          });
          return { templateChapter, aiResponse };
        }),
      );
      results.push(...batchResults);
    }

    for (const { templateChapter, aiResponse } of results) {
      const chapterContent = specification.chapters.find(
        (ch) => ch.chapterWid === templateChapter.wid,
      );

      if (chapterContent) {
        await this.prisma.wakaSpecChapterContent.update({
          where: { id: chapterContent.id },
          data: {
            content: aiResponse,
          },
        });
      }

      await this.prisma.wakaSpecAIHistory.create({
        data: {
          specificationId: specification.id,
          chapterWid: templateChapter.wid,
          action: AIAction.VENTILATE,
          userInstruction: dto.initialText,
          aiResponse,
          userId: dto.userId,
          modelUsed: this.model,
          megaPromptSnapshot: megaPrompt,
          chapterPromptSnapshot: templateChapter.prompt,
          promptVersion: PROMPT_VERSION,
        },
      });
    }

    await this.evaluateAllChaptersInternal(specification.id);

    return this.prisma.wakaSpecification.findUnique({
      where: { id: specification.id },
      include: {
        chapters: {
          orderBy: { chapterOrder: 'asc' },
        },
      },
    });
  }

  async generateChapter(dto: GenerateChapterDto) {
    const specification = await this.prisma.wakaSpecification.findUnique({
      where: { wid: dto.specificationWid },
      include: {
        template: {
          include: {
            chapters: {
              orderBy: { order: 'asc' },
            },
          },
        },
        chapters: true,
      },
    });

    if (!specification) {
      throw new NotFoundException(
        `Specification ${dto.specificationWid} not found`,
      );
    }

    const chapterContent = specification.chapters.find(
      (ch) => ch.chapterWid === dto.chapterWid,
    );

    if (!chapterContent) {
      throw new NotFoundException(
        `Chapter ${dto.chapterWid} not found in specification`,
      );
    }

    const templateChapter = specification.template.chapters.find(
      (ch) => ch.wid === dto.chapterWid,
    );

    if (!templateChapter) {
      throw new NotFoundException(
        `Template chapter ${dto.chapterWid} not found`,
      );
    }

    const megaPrompt = specification.template.megaPrompt;
    let userMessage = templateChapter.prompt;

    if (chapterContent.content) {
      userMessage += `\n\nContenu existant du chapitre :\n\n<user_data>\n${chapterContent.content}\n</user_data>`;
    }

    if (dto.userInstruction) {
      userMessage += `\n\nInstruction utilisateur :\n\n<user_data>\n${dto.userInstruction}\n</user_data>`;
    }

    const aiResponse = await this.callClaude(megaPrompt, userMessage, {
      enableCache: true,
    });

    await this.prisma.wakaSpecChapterContent.update({
      where: { id: chapterContent.id },
      data: {
        content: aiResponse,
      },
    });

    await this.prisma.wakaSpecAIHistory.create({
      data: {
        specificationId: specification.id,
        chapterWid: dto.chapterWid,
        action: AIAction.GENERATE,
        userInstruction: dto.userInstruction ?? null,
        aiResponse,
        userId: dto.userId,
        modelUsed: this.model,
        megaPromptSnapshot: megaPrompt,
        chapterPromptSnapshot: templateChapter.prompt,
        promptVersion: PROMPT_VERSION,
      },
    });

    return this.evaluateChapterInternal(specification.id, dto.chapterWid);
  }

  async modifyContent(dto: ModifyContentDto) {
    const specification = await this.prisma.wakaSpecification.findUnique({
      where: { wid: dto.specificationWid },
      include: {
        chapters: true,
      },
    });

    if (!specification) {
      throw new NotFoundException(
        `Specification ${dto.specificationWid} not found`,
      );
    }

    const chapterContent = specification.chapters.find(
      (ch) => ch.chapterWid === dto.chapterWid,
    );

    if (!chapterContent) {
      throw new NotFoundException(
        `Chapter ${dto.chapterWid} not found in specification`,
      );
    }

    const userMessage = buildModifyContentUserMessage({
      chapterContent: chapterContent.content ?? '',
      selectedText: dto.selectedText,
      userInstruction: dto.userInstruction,
    });

    const aiResponse = await this.callClaude(MODIFY_CONTENT_SYSTEM, userMessage);

    await this.prisma.wakaSpecChapterContent.update({
      where: { id: chapterContent.id },
      data: {
        content: aiResponse,
      },
    });

    await this.prisma.wakaSpecAIHistory.create({
      data: {
        specificationId: specification.id,
        chapterWid: dto.chapterWid,
        action: AIAction.MODIFY,
        userInstruction: `Selection: ${dto.selectedText}\nInstruction: ${dto.userInstruction}`,
        aiResponse,
        userId: dto.userId,
        modelUsed: this.model,
        promptVersion: PROMPT_VERSION,
      },
    });

    return this.evaluateChapterInternal(specification.id, dto.chapterWid);
  }

  async deleteContent(dto: DeleteContentDto) {
    const specification = await this.prisma.wakaSpecification.findUnique({
      where: { wid: dto.specificationWid },
      include: {
        chapters: true,
      },
    });

    if (!specification) {
      throw new NotFoundException(
        `Specification ${dto.specificationWid} not found`,
      );
    }

    const chapterContent = specification.chapters.find(
      (ch) => ch.chapterWid === dto.chapterWid,
    );

    if (!chapterContent) {
      throw new NotFoundException(
        `Chapter ${dto.chapterWid} not found in specification`,
      );
    }

    const currentContent = chapterContent.content ?? '';
    const updatedContent = currentContent.replace(dto.selectedText, '');

    await this.prisma.wakaSpecChapterContent.update({
      where: { id: chapterContent.id },
      data: {
        content: updatedContent,
      },
    });

    await this.prisma.wakaSpecAIHistory.create({
      data: {
        specificationId: specification.id,
        chapterWid: dto.chapterWid,
        action: AIAction.DELETE,
        userInstruction: `Suppression: ${dto.selectedText}`,
        aiResponse: null,
        userId: dto.userId,
      },
    });

    return this.evaluateChapterInternal(specification.id, dto.chapterWid);
  }

  async getHistory(specificationWid: string) {
    const specification = await this.prisma.wakaSpecification.findUnique({
      where: { wid: specificationWid },
    });

    if (!specification) {
      throw new NotFoundException(
        `Specification ${specificationWid} not found`,
      );
    }

    return this.prisma.wakaSpecAIHistory.findMany({
      where: { specificationId: specification.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  async suggestQuestions(
    dto: SuggestQuestionsDto,
  ): Promise<{ questions: SuggestedQuestion[] }> {
    this.logger.debug(
      `Generating contextual questions for chapter: ${dto.chapterTitle} (model=${this.modelLight})`,
    );

    const subChapterList =
      dto.subChapterTitles && dto.subChapterTitles.length > 0
        ? dto.subChapterTitles.join(', ')
        : 'Aucun sous-chapitre défini';

    const userMessage = buildSuggestQuestionsUserMessage({
      chapterTitle: dto.chapterTitle,
      chapterPrompt: dto.chapterPrompt,
      subChapterList,
      existingContent: dto.existingContent,
      initialText: dto.initialText,
    });

    const returnQuestionsTool: Anthropic.Tool = {
      name: 'return_questions',
      description:
        'Retourne la liste de questions générées pour le chapitre de spécification.',
      input_schema: {
        type: 'object' as const,
        properties: {
          questions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                question: { type: 'string' },
                category: {
                  type: 'string',
                  enum: ['fonctionnel', 'technique', 'utilisateur', 'contrainte'],
                },
              },
              required: ['question', 'category'],
            },
          },
        },
        required: ['questions'],
      },
    };

    try {
      const response = await this.anthropic.messages.create({
        model: this.modelLight,
        max_tokens: 1024,
        system: SUGGEST_QUESTIONS_SYSTEM,
        tools: [returnQuestionsTool],
        tool_choice: { type: 'tool', name: 'return_questions' },
        messages: [{ role: 'user', content: userMessage }],
      });

      if (response.stop_reason === 'max_tokens') {
        this.logger.warn(
          `suggestQuestions response truncated (max_tokens) — model=${this.modelLight}`,
        );
      }

      const toolUseBlock = response.content.find(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
      );

      if (!toolUseBlock) {
        this.logger.warn('No tool_use block in suggestQuestions response');
        return { questions: [] };
      }

      const input = toolUseBlock.input as { questions: SuggestedQuestion[] };
      return { questions: input.questions ?? [] };
    } catch (error) {
      this.logger.error(`suggestQuestions Claude API error: ${error}`);
      throw error;
    }
  }

  async testPrompt(
    dto: TestPromptDto,
  ): Promise<{ result: string; tokensUsed: number }> {
    this.logger.debug('Testing prompt without DB persistence');

    let userMessage = dto.chapterPrompt;
    if (dto.sampleInput) {
      userMessage += `\n\nTexte d'entree:\n\n${dto.sampleInput}`;
    }

    const response = await this.anthropic.messages.create({
      model: this.model,
      max_tokens: 500,
      system: dto.megaPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    const textBlock = response.content.find(
      (b): b is Anthropic.TextBlock => b.type === 'text',
    );

    return {
      result: textBlock?.text ?? '',
      tokensUsed:
        (response.usage?.input_tokens ?? 0) +
        (response.usage?.output_tokens ?? 0),
    };
  }

  // ──── Evaluation de completude ────

  async evaluateChapter(dto: EvaluateChapterDto) {
    const specification = await this.prisma.wakaSpecification.findUnique({
      where: { wid: dto.specificationWid },
    });

    if (!specification) {
      throw new NotFoundException(
        `Specification ${dto.specificationWid} not found`,
      );
    }

    return this.evaluateChapterInternal(specification.id, dto.chapterWid);
  }

  async evaluateAllChapters(dto: EvaluateAllChaptersDto) {
    const specification = await this.prisma.wakaSpecification.findUnique({
      where: { wid: dto.specificationWid },
      include: {
        chapters: {
          orderBy: { chapterOrder: 'asc' },
        },
      },
    });

    if (!specification) {
      throw new NotFoundException(
        `Specification ${dto.specificationWid} not found`,
      );
    }

    await this.evaluateAllChaptersInternal(specification.id);

    return this.prisma.wakaSpecification.findUnique({
      where: { id: specification.id },
      include: {
        chapters: {
          orderBy: { chapterOrder: 'asc' },
        },
      },
    });
  }

  // ──── Private methods ────

  private async evaluateChapterInternal(
    specificationId: number,
    chapterWid: string,
  ) {
    const specification = await this.prisma.wakaSpecification.findUnique({
      where: { id: specificationId },
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

    const chapterContent = await this.prisma.wakaSpecChapterContent.findFirst({
      where: { specificationId, chapterWid },
    });

    if (!chapterContent) {
      throw new NotFoundException(
        `Chapter ${chapterWid} not found in specification`,
      );
    }

    const content = chapterContent.content ?? '';

    // Pre-check par regles : contenu vide ou trop court
    if (!content.trim()) {
      return this.updateChapterEvaluation(chapterContent.id, specificationId, {
        score: 0,
        coveredTopics: [],
        missingTopics: [],
        feedback: 'Le chapitre est vide.',
        model: 'rule-based',
      });
    }

    if (content.trim().length < 50) {
      return this.updateChapterEvaluation(chapterContent.id, specificationId, {
        score: 5,
        coveredTopics: [],
        missingTopics: [],
        feedback: 'Le contenu est trop court pour constituer une analyse.',
        model: 'rule-based',
      });
    }

    // Evaluation IA
    const templateChapter = specification?.template.chapters.find(
      (ch) => ch.wid === chapterWid,
    );

    if (!templateChapter) {
      // Chapitre dynamique sans template : garder une evaluation simple par longueur
      const score = Math.min(80, Math.round(content.length / 50));
      return this.updateChapterEvaluation(chapterContent.id, specificationId, {
        score,
        coveredTopics: [],
        missingTopics: [],
        feedback: 'Chapitre dynamique - evaluation basee sur la longueur du contenu.',
        model: 'rule-based',
      });
    }

    // Construire la liste des sous-sections attendues
    const subSections = templateChapter.subChaptersL1
      .map((l1) => {
        const l2Titles = l1.subChaptersL2.map((l2) => l2.title).join(', ');
        return l2Titles ? `${l1.title} (${l2Titles})` : l1.title;
      })
      .join('; ');

    try {
      const evaluation = await this.callClaudeForEvaluation(
        templateChapter.prompt,
        subSections || 'Aucun sous-chapitre defini',
        content,
      );

      return this.updateChapterEvaluation(
        chapterContent.id,
        specificationId,
        evaluation,
      );
    } catch (error) {
      this.logger.error(
        `Evaluation failed for chapter ${chapterWid}: ${error}`,
      );
      // En cas d'erreur, ne pas bloquer : recalculer avec le progress actuel
      await this.recalculateProgress(specificationId);
      return this.prisma.wakaSpecChapterContent.findFirst({
        where: { id: chapterContent.id },
      });
    }
  }

  private async evaluateAllChaptersInternal(
    specificationId: number,
  ): Promise<void> {
    const chapters = await this.prisma.wakaSpecChapterContent.findMany({
      where: { specificationId },
    });

    for (const chapter of chapters) {
      try {
        await this.evaluateChapterInternal(specificationId, chapter.chapterWid);
      } catch (error) {
        this.logger.error(
          `Evaluation failed for chapter ${chapter.chapterWid}: ${error}`,
        );
      }
    }
  }

  private async updateChapterEvaluation(
    chapterContentId: number,
    specificationId: number,
    evaluation: ChapterEvaluationDetails,
  ) {
    const updated = await this.prisma.wakaSpecChapterContent.update({
      where: { id: chapterContentId },
      data: {
        progress: evaluation.score,
        evaluationDetails: evaluation as any,
        evaluatedAt: new Date(),
      },
    });

    await this.recalculateProgress(specificationId);

    return updated;
  }

  private async callClaudeForEvaluation(
    chapterPrompt: string,
    subSections: string,
    content: string,
  ): Promise<ChapterEvaluationDetails> {
    const systemPrompt = `Tu es un evaluateur de completude de specifications fonctionnelles.
Analyse le contenu du chapitre par rapport aux exigences definies.
Retourne UNIQUEMENT un objet JSON valide (pas de texte autour) :
{
  "score": <number 0-100>,
  "coveredTopics": ["sujet1", "sujet2"],
  "missingTopics": ["sujet3"],
  "feedback": "<1 phrase resumant l'etat de completude>"
}

Criteres de scoring :
- 0-10 : Contenu vide ou hors sujet
- 10-30 : Quelques elements pertinents mais tres incomplet
- 30-60 : Plusieurs sujets couverts mais manques importants
- 60-80 : Bonne couverture, quelques details manquants
- 80-95 : Tres complet, details mineurs absents
- 95-100 : Exhaustif, tous les sujets attendus sont couverts en profondeur`;

    // Tronquer le contenu a 3000 chars pour limiter les couts
    const truncatedContent =
      content.length > 3000
        ? content.slice(0, 1500) + '\n\n[...]\n\n' + content.slice(-1500)
        : content;

    const userMessage = `Exigences du chapitre :\n${chapterPrompt}\n\nSous-sections attendues :\n${subSections}\n\nContenu a evaluer :\n${truncatedContent}`;

    this.logger.debug(`Evaluating chapter with model ${this.modelLight}`);

    const response = await this.anthropic.messages.create({
      model: this.modelLight,
      max_tokens: 512,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    const textBlock = response.content.find(
      (b): b is Anthropic.TextBlock => b.type === 'text',
    );

    const rawText = textBlock?.text ?? '';

    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON object found in evaluation response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        score: Math.max(0, Math.min(100, Math.round(parsed.score ?? 0))),
        coveredTopics: Array.isArray(parsed.coveredTopics)
          ? parsed.coveredTopics
          : [],
        missingTopics: Array.isArray(parsed.missingTopics)
          ? parsed.missingTopics
          : [],
        feedback: parsed.feedback ?? '',
        model: this.modelLight,
      };
    } catch (error) {
      this.logger.error(
        `Failed to parse evaluation response: ${error}. Raw: ${rawText}`,
      );
      throw error;
    }
  }

  private async callClaude(
    system: string,
    userMessage: string,
    options?: { enableCache?: boolean; model?: string },
  ): Promise<string> {
    const model = options?.model ?? this.model;
    this.logger.debug(
      `Calling Claude model ${model} (cache=${options?.enableCache ?? false}, promptVersion=${PROMPT_VERSION})`,
    );

    try {
      const systemParam: Anthropic.MessageParam['content'] | string =
        options?.enableCache
          ? [
              {
                type: 'text',
                text: system,
                cache_control: { type: 'ephemeral' },
              } as Anthropic.TextBlockParam & {
                cache_control: { type: 'ephemeral' };
              },
            ]
          : system;

      const response = await this.anthropic.messages.create({
        model,
        max_tokens: 4096,
        system: systemParam as Anthropic.MessageCreateParamsNonStreaming['system'],
        messages: [{ role: 'user', content: userMessage }],
      });

      if (response.stop_reason === 'max_tokens') {
        this.logger.warn(
          `Claude response truncated (max_tokens reached) — model=${model} promptVersion=${PROMPT_VERSION}`,
        );
      }

      const textBlock = response.content.find(
        (b): b is Anthropic.TextBlock => b.type === 'text',
      );
      return textBlock?.text ?? '';
    } catch (error) {
      this.logger.error(`Claude API error: ${error}`);
      throw error;
    }
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
}
