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

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly anthropic: Anthropic;
  private readonly model: string;

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

    const results = await Promise.all(
      templateChapters.map(async (templateChapter) => {
        const userMessage = `${templateChapter.prompt}\n\nVoici le texte initial a ventiler dans ce chapitre:\n\n${dto.initialText}`;
        const aiResponse = await this.callClaude(megaPrompt, userMessage);

        return {
          templateChapter,
          aiResponse,
        };
      }),
    );

    for (const { templateChapter, aiResponse } of results) {
      const chapterContent = specification.chapters.find(
        (ch) => ch.chapterWid === templateChapter.wid,
      );

      if (chapterContent) {
        await this.prisma.wakaSpecChapterContent.update({
          where: { id: chapterContent.id },
          data: {
            content: aiResponse,
            progress: 30,
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
        },
      });
    }

    await this.recalculateProgress(specification.id);

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
      userMessage += `\n\nContenu existant du chapitre:\n\n${chapterContent.content}`;
    }

    if (dto.userInstruction) {
      userMessage += `\n\nInstruction utilisateur:\n\n${dto.userInstruction}`;
    }

    const aiResponse = await this.callClaude(megaPrompt, userMessage);

    const currentProgress = chapterContent.progress;
    const newProgress = Math.max(currentProgress, 50);

    const updatedChapter = await this.prisma.wakaSpecChapterContent.update({
      where: { id: chapterContent.id },
      data: {
        content: aiResponse,
        progress: newProgress,
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
      },
    });

    await this.recalculateProgress(specification.id);

    return updatedChapter;
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

    const systemPrompt =
      'Tu es un assistant de redaction de specifications fonctionnelles. Modifie uniquement le texte selectionne dans le contexte du chapitre. Retourne le contenu COMPLET du chapitre avec la modification appliquee.';

    const userMessage = `Contexte du chapitre:\n${chapterContent.content ?? ''}\n\nTexte selectionne a modifier:\n${dto.selectedText}\n\nInstruction:\n${dto.userInstruction}`;

    const aiResponse = await this.callClaude(systemPrompt, userMessage);

    const updatedChapter = await this.prisma.wakaSpecChapterContent.update({
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
      },
    });

    return updatedChapter;
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

    const updatedChapter = await this.prisma.wakaSpecChapterContent.update({
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

    return updatedChapter;
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

  private async callClaude(
    system: string,
    userMessage: string,
  ): Promise<string> {
    this.logger.debug(`Calling Claude model ${this.model}`);

    try {
      const response = await this.anthropic.messages.create({
        model: this.model,
        max_tokens: 4096,
        system,
        messages: [{ role: 'user', content: userMessage }],
      });

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
