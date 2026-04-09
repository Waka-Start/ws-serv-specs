import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { TemplatesService } from '../templates/templates.service.js';
import { CreateSpecificationDto } from './dto/create-specification.dto.js';
import { UpdateSpecificationDto } from './dto/update-specification.dto.js';
import { UpdateChapterContentDto } from './dto/update-chapter-content.dto.js';
import { QuerySpecificationsDto } from './dto/query-specifications.dto.js';
import { CreateDynamicSubChapterDto } from './dto/create-dynamic-subchapter.dto.js';
import type { Prisma } from '@prisma/client';

@Injectable()
export class SpecificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly templatesService: TemplatesService,
  ) {}

  async findAll(query: QuerySpecificationsDto) {
    const where: Prisma.WakaSpecificationWhereInput = {};

    if (query.projectId) {
      where.projectId = query.projectId;
    }
    if (query.stepId) {
      where.stepId = query.stepId;
    }

    return this.prisma.wakaSpecification.findMany({
      where,
      include: {
        chapters: {
          orderBy: { chapterOrder: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(wid: string) {
    const specification = await this.prisma.wakaSpecification.findUnique({
      where: { wid },
      include: {
        chapters: {
          orderBy: { chapterOrder: 'asc' },
        },
      },
    });

    if (!specification) {
      throw new NotFoundException(`Specification with wid "${wid}" not found`);
    }

    return specification;
  }

  async create(dto: CreateSpecificationDto) {
    const template = await this.templatesService.findOne(dto.templateWid);

    return this.prisma.$transaction(async (tx) => {
      const specification = await tx.wakaSpecification.create({
        data: {
          templateId: template.id,
          projectId: dto.projectId,
          stepId: dto.stepId,
          name: dto.name,
          initialText: dto.initialText,
          createdBy: dto.createdBy,
        },
      });

      const chapterData = template.chapters.map((chapter) => ({
        specificationId: specification.id,
        chapterWid: chapter.wid,
        chapterTitle: chapter.title,
        chapterOrder: chapter.order,
      }));

      if (chapterData.length > 0) {
        await tx.wakaSpecChapterContent.createMany({
          data: chapterData,
        });
      }

      return tx.wakaSpecification.findUnique({
        where: { id: specification.id },
        include: {
          chapters: {
            orderBy: { chapterOrder: 'asc' },
          },
        },
      });
    });
  }

  async update(wid: string, dto: UpdateSpecificationDto) {
    const existing = await this.findOne(wid);

    const updated = await this.prisma.wakaSpecification.update({
      where: { id: existing.id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.updatedBy !== undefined && { updatedBy: dto.updatedBy }),
      },
      include: {
        chapters: {
          orderBy: { chapterOrder: 'asc' },
        },
      },
    });

    if (dto.status !== undefined) {
      return this.recalculateGlobalProgress(updated.id);
    }

    return updated;
  }

  async softDelete(wid: string) {
    const existing = await this.findOne(wid);

    await this.prisma.wakaSpecification.delete({
      where: { id: existing.id },
    });

    return { deleted: true, wid };
  }

  async getChapterContent(specWid: string, chapterWid: string) {
    const specification = await this.findOne(specWid);

    const chapter = await this.prisma.wakaSpecChapterContent.findFirst({
      where: {
        specificationId: specification.id,
        chapterWid,
      },
    });

    if (!chapter) {
      throw new NotFoundException(
        `Chapter "${chapterWid}" not found in specification "${specWid}"`,
      );
    }

    return chapter;
  }

  async updateChapterContent(
    specWid: string,
    chapterWid: string,
    dto: UpdateChapterContentDto,
  ) {
    const specification = await this.findOne(specWid);

    const existingChapter = await this.prisma.wakaSpecChapterContent.findFirst({
      where: {
        specificationId: specification.id,
        chapterWid,
      },
    });

    if (!existingChapter) {
      throw new NotFoundException(
        `Chapter "${chapterWid}" not found in specification "${specWid}"`,
      );
    }

    await this.prisma.wakaSpecChapterContent.update({
      where: { id: existingChapter.id },
      data: {
        content: dto.content,
        ...(dto.progress !== undefined && { progress: dto.progress }),
        ...(dto.isAutoSaved !== undefined && { isAutoSaved: dto.isAutoSaved }),
      },
    });

    return this.recalculateGlobalProgress(specification.id);
  }

  async addDynamicSubChapter(
    specWid: string,
    dto: CreateDynamicSubChapterDto,
  ) {
    const specification = await this.findOne(specWid);

    const lastChapter = await this.prisma.wakaSpecChapterContent.findFirst({
      where: { specificationId: specification.id },
      orderBy: { chapterOrder: 'desc' },
    });

    const nextOrder = lastChapter ? lastChapter.chapterOrder + 1 : 1;

    return this.prisma.wakaSpecChapterContent.create({
      data: {
        specificationId: specification.id,
        chapterWid: dto.chapterWid,
        chapterTitle: dto.title,
        chapterOrder: nextOrder,
      },
    });
  }

  async removeDynamicSubChapter(
    specWid: string,
    chapterContentWid: string,
  ) {
    const specification = await this.findOne(specWid);

    const chapter = await this.prisma.wakaSpecChapterContent.findFirst({
      where: {
        specificationId: specification.id,
        wid: chapterContentWid,
      },
    });

    if (!chapter) {
      throw new NotFoundException(
        `Chapter content "${chapterContentWid}" not found in specification "${specWid}"`,
      );
    }

    await this.prisma.wakaSpecChapterContent.delete({
      where: { id: chapter.id },
    });

    return { deleted: true, wid: chapterContentWid };
  }

  async exportMarkdown(specWid: string) {
    const specification = await this.prisma.wakaSpecification.findUnique({
      where: { wid: specWid },
      include: {
        template: true,
        chapters: {
          orderBy: { chapterOrder: 'asc' },
        },
      },
    });

    if (!specification) {
      throw new NotFoundException(
        `Specification with wid "${specWid}" not found`,
      );
    }

    const lines: string[] = [];

    lines.push(`# ${specification.template.title}`);
    lines.push('');
    lines.push(specification.template.docDescription);
    lines.push('');

    for (const chapter of specification.chapters) {
      lines.push(`## ${chapter.chapterTitle}`);
      lines.push('');
      if (chapter.content) {
        lines.push(chapter.content);
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  async saveVersion(specWid: string) {
    const specification = await this.findOne(specWid);

    const markdown = await this.exportMarkdown(specWid);

    const updated = await this.prisma.wakaSpecification.update({
      where: { id: specification.id },
      data: {
        version: specification.version + 1,
      },
    });

    return {
      markdown,
      version: updated.version,
      wid: updated.wid,
    };
  }

  private async recalculateGlobalProgress(specificationId: number) {
    const chapters = await this.prisma.wakaSpecChapterContent.findMany({
      where: { specificationId },
    });

    const globalProgress =
      chapters.length > 0
        ? Math.round(
            chapters.reduce((sum, ch) => sum + ch.progress, 0) /
              chapters.length,
          )
        : 0;

    return this.prisma.wakaSpecification.update({
      where: { id: specificationId },
      data: { globalProgress },
      include: {
        chapters: {
          orderBy: { chapterOrder: 'asc' },
        },
      },
    });
  }
}
