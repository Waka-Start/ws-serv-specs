import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateTemplateDto } from './dto/create-template.dto.js';
import { UpdateTemplateDto } from './dto/update-template.dto.js';
import { CreateChapterDto } from './dto/create-chapter.dto.js';
import { UpdateChapterDto } from './dto/update-chapter.dto.js';
import { ReorderChaptersDto } from './dto/reorder-chapters.dto.js';
import { CreateSubChapterL1Dto } from './dto/create-sub-chapter-l1.dto.js';
import { UpdateSubChapterL1Dto } from './dto/update-sub-chapter-l1.dto.js';
import { CreateSubChapterL2Dto } from './dto/create-sub-chapter-l2.dto.js';
import { UpdateSubChapterL2Dto } from './dto/update-sub-chapter-l2.dto.js';

const FULL_HIERARCHY_INCLUDE = {
  chapters: {
    orderBy: { order: 'asc' as const },
    include: {
      subChaptersL1: {
        orderBy: { order: 'asc' as const },
        include: {
          subChaptersL2: {
            orderBy: { order: 'asc' as const },
          },
        },
      },
    },
  },
};

@Injectable()
export class TemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.wakaSpecTemplate.findMany({
      where: { isActive: true },
      include: FULL_HIERARCHY_INCLUDE,
    });
  }

  async findOne(wid: string) {
    const template = await this.prisma.wakaSpecTemplate.findUnique({
      where: { wid },
      include: FULL_HIERARCHY_INCLUDE,
    });

    if (!template) {
      throw new NotFoundException(`Template with wid "${wid}" not found`);
    }

    return template;
  }

  async create(dto: CreateTemplateDto) {
    return this.prisma.wakaSpecTemplate.create({
      data: {
        title: dto.title,
        userDescription: dto.userDescription ?? '',
        docDescription: dto.docDescription ?? '',
        megaPrompt: dto.megaPrompt ?? '',
        createdBy: dto.createdBy ?? 'system',
      },
      include: FULL_HIERARCHY_INCLUDE,
    });
  }

  async update(wid: string, dto: UpdateTemplateDto) {
    await this.findOne(wid);

    return this.prisma.wakaSpecTemplate.update({
      where: { wid },
      data: dto,
      include: FULL_HIERARCHY_INCLUDE,
    });
  }

  async softDelete(wid: string) {
    await this.findOne(wid);

    return this.prisma.wakaSpecTemplate.update({
      where: { wid },
      data: { isActive: false },
    });
  }

  // ── Chapters ────────────────────────────────────────────────────

  async addChapter(templateWid: string, dto: CreateChapterDto) {
    const template = await this.findOne(templateWid);

    const maxOrder = await this.prisma.wakaSpecTemplateChapter.aggregate({
      where: { templateId: template.id },
      _max: { order: true },
    });

    const nextOrder = (maxOrder._max.order ?? -1) + 1;

    return this.prisma.wakaSpecTemplateChapter.create({
      data: {
        templateId: template.id,
        title: dto.title,
        userDescription: dto.userDescription,
        docDescription: dto.docDescription,
        prompt: dto.prompt,
        isVariable: dto.isVariable ?? false,
        order: nextOrder,
      },
      include: {
        subChaptersL1: {
          orderBy: { order: 'asc' },
          include: {
            subChaptersL2: { orderBy: { order: 'asc' } },
          },
        },
      },
    });
  }

  async updateChapter(templateWid: string, chapterWid: string, dto: UpdateChapterDto) {
    const template = await this.findOne(templateWid);

    const chapter = await this.prisma.wakaSpecTemplateChapter.findUnique({
      where: { wid: chapterWid },
    });

    if (!chapter || chapter.templateId !== template.id) {
      throw new NotFoundException(
        `Chapter with wid "${chapterWid}" not found in template "${templateWid}"`,
      );
    }

    return this.prisma.wakaSpecTemplateChapter.update({
      where: { wid: chapterWid },
      data: dto,
      include: {
        subChaptersL1: {
          orderBy: { order: 'asc' },
          include: {
            subChaptersL2: { orderBy: { order: 'asc' } },
          },
        },
      },
    });
  }

  async deleteChapter(templateWid: string, chapterWid: string) {
    const template = await this.findOne(templateWid);

    const chapter = await this.prisma.wakaSpecTemplateChapter.findUnique({
      where: { wid: chapterWid },
    });

    if (!chapter || chapter.templateId !== template.id) {
      throw new NotFoundException(
        `Chapter with wid "${chapterWid}" not found in template "${templateWid}"`,
      );
    }

    return this.prisma.wakaSpecTemplateChapter.delete({
      where: { wid: chapterWid },
    });
  }

  async reorderChapters(templateWid: string, dto: ReorderChaptersDto) {
    await this.findOne(templateWid);

    await this.prisma.$transaction(
      dto.items.map((item) =>
        this.prisma.wakaSpecTemplateChapter.update({
          where: { wid: item.wid },
          data: { order: item.order },
        }),
      ),
    );

    return this.findOne(templateWid);
  }

  // ── Sub-Chapters L1 ────────────────────────────────────────────

  async addSubChapterL1(chapterWid: string, dto: CreateSubChapterL1Dto) {
    const chapter = await this.prisma.wakaSpecTemplateChapter.findUnique({
      where: { wid: chapterWid },
    });

    if (!chapter) {
      throw new NotFoundException(`Chapter with wid "${chapterWid}" not found`);
    }

    const maxOrder = await this.prisma.wakaSpecTemplateSubChapterL1.aggregate({
      where: { chapterId: chapter.id },
      _max: { order: true },
    });

    const nextOrder = (maxOrder._max.order ?? -1) + 1;

    return this.prisma.wakaSpecTemplateSubChapterL1.create({
      data: {
        chapterId: chapter.id,
        title: dto.title,
        isVariable: dto.isVariable ?? false,
        order: nextOrder,
      },
      include: {
        subChaptersL2: { orderBy: { order: 'asc' } },
      },
    });
  }

  async updateSubChapterL1(scWid: string, dto: UpdateSubChapterL1Dto) {
    const existing = await this.prisma.wakaSpecTemplateSubChapterL1.findUnique({
      where: { wid: scWid },
    });

    if (!existing) {
      throw new NotFoundException(`SubChapterL1 with wid "${scWid}" not found`);
    }

    return this.prisma.wakaSpecTemplateSubChapterL1.update({
      where: { wid: scWid },
      data: dto,
      include: {
        subChaptersL2: { orderBy: { order: 'asc' } },
      },
    });
  }

  async deleteSubChapterL1(scWid: string) {
    const existing = await this.prisma.wakaSpecTemplateSubChapterL1.findUnique({
      where: { wid: scWid },
    });

    if (!existing) {
      throw new NotFoundException(`SubChapterL1 with wid "${scWid}" not found`);
    }

    return this.prisma.wakaSpecTemplateSubChapterL1.delete({
      where: { wid: scWid },
    });
  }

  // ── Sub-Chapters L2 ────────────────────────────────────────────

  async addSubChapterL2(scL1Wid: string, dto: CreateSubChapterL2Dto) {
    const scL1 = await this.prisma.wakaSpecTemplateSubChapterL1.findUnique({
      where: { wid: scL1Wid },
    });

    if (!scL1) {
      throw new NotFoundException(`SubChapterL1 with wid "${scL1Wid}" not found`);
    }

    const maxOrder = await this.prisma.wakaSpecTemplateSubChapterL2.aggregate({
      where: { subChapterL1Id: scL1.id },
      _max: { order: true },
    });

    const nextOrder = (maxOrder._max.order ?? -1) + 1;

    return this.prisma.wakaSpecTemplateSubChapterL2.create({
      data: {
        subChapterL1Id: scL1.id,
        title: dto.title,
        order: nextOrder,
      },
    });
  }

  async updateSubChapterL2(sc2Wid: string, dto: UpdateSubChapterL2Dto) {
    const existing = await this.prisma.wakaSpecTemplateSubChapterL2.findUnique({
      where: { wid: sc2Wid },
    });

    if (!existing) {
      throw new NotFoundException(`SubChapterL2 with wid "${sc2Wid}" not found`);
    }

    return this.prisma.wakaSpecTemplateSubChapterL2.update({
      where: { wid: sc2Wid },
      data: dto,
    });
  }

  async deleteSubChapterL2(sc2Wid: string) {
    const existing = await this.prisma.wakaSpecTemplateSubChapterL2.findUnique({
      where: { wid: sc2Wid },
    });

    if (!existing) {
      throw new NotFoundException(`SubChapterL2 with wid "${sc2Wid}" not found`);
    }

    return this.prisma.wakaSpecTemplateSubChapterL2.delete({
      where: { wid: sc2Wid },
    });
  }
}
