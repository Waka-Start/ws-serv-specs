// Mocks virtuels pnpm strict
jest.mock('pg', () => ({ Pool: jest.fn() }), { virtual: true });
jest.mock('@prisma/adapter-pg', () => ({ PrismaPg: jest.fn() }), { virtual: true });
jest.mock('@prisma/client', () => ({ PrismaClient: jest.fn() }), { virtual: true });

import { Test, TestingModule } from '@nestjs/testing';
import { TemplatesService } from './templates.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

const mockPrismaService = {
  wakaSpecTemplate: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  wakaSpecTemplateChapter: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    aggregate: jest.fn(),
  },
  wakaSpecTemplateSubChapterL1: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    aggregate: jest.fn(),
  },
  wakaSpecTemplateSubChapterL2: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    aggregate: jest.fn(),
  },
  $transaction: jest.fn(),
};

describe('TemplatesService', () => {
  let service: TemplatesService;
  let prisma: typeof mockPrismaService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TemplatesService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<TemplatesService>(TemplatesService);
    prisma = module.get(PrismaService);
  });

  // ── findAll ─────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return active templates with full hierarchy', async () => {
      const templates = [
        {
          id: 1,
          wid: 'tpl-1',
          title: 'Template 1',
          isActive: true,
          chapters: [],
        },
      ];
      prisma.wakaSpecTemplate.findMany.mockResolvedValue(templates);

      const result = await service.findAll();

      expect(result).toEqual(templates);
      expect(prisma.wakaSpecTemplate.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        include: expect.objectContaining({
          chapters: expect.objectContaining({
            orderBy: { order: 'asc' },
          }),
        }),
      });
    });
  });

  // ── findOne ─────────────────────────────────────────────────────

  describe('findOne', () => {
    it('should return a template by wid', async () => {
      const template = {
        id: 1,
        wid: 'tpl-1',
        title: 'Template 1',
        isActive: true,
        chapters: [],
      };
      prisma.wakaSpecTemplate.findUnique.mockResolvedValue(template);

      const result = await service.findOne('tpl-1');

      expect(result).toEqual(template);
      expect(prisma.wakaSpecTemplate.findUnique).toHaveBeenCalledWith({
        where: { wid: 'tpl-1' },
        include: expect.objectContaining({
          chapters: expect.objectContaining({
            orderBy: { order: 'asc' },
          }),
        }),
      });
    });

    it('should throw NotFoundException for unknown wid', async () => {
      prisma.wakaSpecTemplate.findUnique.mockResolvedValue(null);

      await expect(service.findOne('unknown')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── create ──────────────────────────────────────────────────────

  describe('create', () => {
    it('should create a template with correct data', async () => {
      const dto = {
        title: 'New Template',
        userDescription: 'User desc',
        docDescription: 'Doc desc',
        megaPrompt: 'Mega prompt',
        createdBy: 'user-1',
      };
      const created = { id: 1, wid: 'tpl-new', ...dto, chapters: [] };
      prisma.wakaSpecTemplate.create.mockResolvedValue(created);

      const result = await service.create(dto);

      expect(result).toEqual(created);
      expect(prisma.wakaSpecTemplate.create).toHaveBeenCalledWith({
        data: {
          title: dto.title,
          userDescription: dto.userDescription,
          docDescription: dto.docDescription,
          megaPrompt: dto.megaPrompt,
          createdBy: dto.createdBy,
        },
        include: expect.any(Object),
      });
    });
  });

  // ── update ──────────────────────────────────────────────────────

  describe('update', () => {
    it('should update template fields', async () => {
      const existing = {
        id: 1,
        wid: 'tpl-1',
        title: 'Old',
        isActive: true,
        chapters: [],
      };
      prisma.wakaSpecTemplate.findUnique.mockResolvedValue(existing);

      const dto = { title: 'Updated Title' };
      const updated = { ...existing, ...dto };
      prisma.wakaSpecTemplate.update.mockResolvedValue(updated);

      const result = await service.update('tpl-1', dto);

      expect(result).toEqual(updated);
      expect(prisma.wakaSpecTemplate.update).toHaveBeenCalledWith({
        where: { wid: 'tpl-1' },
        data: dto,
        include: expect.any(Object),
      });
    });

    it('should throw NotFoundException if template does not exist', async () => {
      prisma.wakaSpecTemplate.findUnique.mockResolvedValue(null);

      await expect(
        service.update('unknown', { title: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── softDelete ──────────────────────────────────────────────────

  describe('softDelete', () => {
    it('should set isActive to false', async () => {
      const existing = {
        id: 1,
        wid: 'tpl-1',
        title: 'Template',
        isActive: true,
        chapters: [],
      };
      prisma.wakaSpecTemplate.findUnique.mockResolvedValue(existing);
      prisma.wakaSpecTemplate.update.mockResolvedValue({
        ...existing,
        isActive: false,
      });

      const result = await service.softDelete('tpl-1');

      expect(result.isActive).toBe(false);
      expect(prisma.wakaSpecTemplate.update).toHaveBeenCalledWith({
        where: { wid: 'tpl-1' },
        data: { isActive: false },
      });
    });
  });

  // ── addChapter ──────────────────────────────────────────────────

  describe('addChapter', () => {
    it('should create a chapter with the correct order', async () => {
      const template = {
        id: 1,
        wid: 'tpl-1',
        title: 'T',
        isActive: true,
        chapters: [],
      };
      prisma.wakaSpecTemplate.findUnique.mockResolvedValue(template);
      prisma.wakaSpecTemplateChapter.aggregate.mockResolvedValue({
        _max: { order: 2 },
      });

      const dto = {
        title: 'Chapter 1',
        prompt: 'Generate something',
      };
      const created = {
        id: 10,
        wid: 'ch-1',
        ...dto,
        order: 3,
        subChaptersL1: [],
      };
      prisma.wakaSpecTemplateChapter.create.mockResolvedValue(created);

      const result = await service.addChapter('tpl-1', dto);

      expect(result).toEqual(created);
      expect(prisma.wakaSpecTemplateChapter.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            templateId: 1,
            title: 'Chapter 1',
            order: 3,
          }),
        }),
      );
    });

    it('should start at order 0 when no chapters exist', async () => {
      const template = {
        id: 1,
        wid: 'tpl-1',
        title: 'T',
        isActive: true,
        chapters: [],
      };
      prisma.wakaSpecTemplate.findUnique.mockResolvedValue(template);
      prisma.wakaSpecTemplateChapter.aggregate.mockResolvedValue({
        _max: { order: null },
      });
      prisma.wakaSpecTemplateChapter.create.mockResolvedValue({
        id: 10,
        order: 0,
      });

      await service.addChapter('tpl-1', {
        title: 'First',
        prompt: 'p',
      });

      expect(prisma.wakaSpecTemplateChapter.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ order: 0 }),
        }),
      );
    });
  });

  // ── updateChapter ───────────────────────────────────────────────

  describe('updateChapter', () => {
    it('should update a chapter', async () => {
      const template = {
        id: 1,
        wid: 'tpl-1',
        title: 'T',
        isActive: true,
        chapters: [],
      };
      prisma.wakaSpecTemplate.findUnique.mockResolvedValue(template);
      prisma.wakaSpecTemplateChapter.findUnique.mockResolvedValue({
        id: 10,
        wid: 'ch-1',
        templateId: 1,
      });
      prisma.wakaSpecTemplateChapter.update.mockResolvedValue({
        id: 10,
        wid: 'ch-1',
        title: 'Updated',
      });

      const result = await service.updateChapter('tpl-1', 'ch-1', {
        title: 'Updated',
      });

      expect(result.title).toBe('Updated');
    });

    it('should throw NotFoundException if chapter does not belong to template', async () => {
      const template = {
        id: 1,
        wid: 'tpl-1',
        title: 'T',
        isActive: true,
        chapters: [],
      };
      prisma.wakaSpecTemplate.findUnique.mockResolvedValue(template);
      prisma.wakaSpecTemplateChapter.findUnique.mockResolvedValue({
        id: 10,
        wid: 'ch-1',
        templateId: 999, // different template
      });

      await expect(
        service.updateChapter('tpl-1', 'ch-1', { title: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── deleteChapter ───────────────────────────────────────────────

  describe('deleteChapter', () => {
    it('should delete the chapter', async () => {
      const template = {
        id: 1,
        wid: 'tpl-1',
        title: 'T',
        isActive: true,
        chapters: [],
      };
      prisma.wakaSpecTemplate.findUnique.mockResolvedValue(template);
      prisma.wakaSpecTemplateChapter.findUnique.mockResolvedValue({
        id: 10,
        wid: 'ch-1',
        templateId: 1,
      });
      prisma.wakaSpecTemplateChapter.delete.mockResolvedValue({
        id: 10,
        wid: 'ch-1',
      });

      const result = await service.deleteChapter('tpl-1', 'ch-1');

      expect(result).toEqual({ id: 10, wid: 'ch-1' });
      expect(prisma.wakaSpecTemplateChapter.delete).toHaveBeenCalledWith({
        where: { wid: 'ch-1' },
      });
    });

    it('should throw NotFoundException if chapter not found', async () => {
      const template = {
        id: 1,
        wid: 'tpl-1',
        title: 'T',
        isActive: true,
        chapters: [],
      };
      prisma.wakaSpecTemplate.findUnique.mockResolvedValue(template);
      prisma.wakaSpecTemplateChapter.findUnique.mockResolvedValue(null);

      await expect(
        service.deleteChapter('tpl-1', 'unknown'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── reorderChapters ─────────────────────────────────────────────

  describe('reorderChapters', () => {
    it('should use $transaction to reorder chapters', async () => {
      const template = {
        id: 1,
        wid: 'tpl-1',
        title: 'T',
        isActive: true,
        chapters: [],
      };
      // findOne is called twice: once for validation, once to return result
      prisma.wakaSpecTemplate.findUnique.mockResolvedValue(template);
      prisma.$transaction.mockResolvedValue([]);

      const dto = {
        items: [
          { wid: 'ch-1', order: 1 },
          { wid: 'ch-2', order: 0 },
        ],
      };

      await service.reorderChapters('tpl-1', dto);

      expect(prisma.$transaction).toHaveBeenCalledWith(
        expect.arrayContaining([expect.any(Object)]),
      );
    });
  });

  // ── addSubChapterL1 ─────────────────────────────────────────────

  describe('addSubChapterL1', () => {
    it('should create an L1 sub-chapter with correct order', async () => {
      prisma.wakaSpecTemplateChapter.findUnique.mockResolvedValue({
        id: 10,
        wid: 'ch-1',
      });
      prisma.wakaSpecTemplateSubChapterL1.aggregate.mockResolvedValue({
        _max: { order: 1 },
      });
      prisma.wakaSpecTemplateSubChapterL1.create.mockResolvedValue({
        id: 20,
        wid: 'sc1-1',
        title: 'Sub L1',
        order: 2,
        subChaptersL2: [],
      });

      const result = await service.addSubChapterL1('ch-1', {
        title: 'Sub L1',
      });

      expect(result.order).toBe(2);
      expect(
        prisma.wakaSpecTemplateSubChapterL1.create,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            chapterId: 10,
            title: 'Sub L1',
            order: 2,
          }),
        }),
      );
    });

    it('should throw NotFoundException if chapter does not exist', async () => {
      prisma.wakaSpecTemplateChapter.findUnique.mockResolvedValue(null);

      await expect(
        service.addSubChapterL1('unknown', { title: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── deleteSubChapterL1 ─────────────────────────────────────────

  describe('deleteSubChapterL1', () => {
    it('should delete L1 sub-chapter', async () => {
      prisma.wakaSpecTemplateSubChapterL1.findUnique.mockResolvedValue({
        id: 20,
        wid: 'sc1-1',
      });
      prisma.wakaSpecTemplateSubChapterL1.delete.mockResolvedValue({
        id: 20,
        wid: 'sc1-1',
      });

      const result = await service.deleteSubChapterL1('sc1-1');

      expect(result).toEqual({ id: 20, wid: 'sc1-1' });
    });

    it('should throw NotFoundException if L1 does not exist', async () => {
      prisma.wakaSpecTemplateSubChapterL1.findUnique.mockResolvedValue(
        null,
      );

      await expect(
        service.deleteSubChapterL1('unknown'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── addSubChapterL2 ─────────────────────────────────────────────

  describe('addSubChapterL2', () => {
    it('should create an L2 sub-chapter with correct order', async () => {
      prisma.wakaSpecTemplateSubChapterL1.findUnique.mockResolvedValue({
        id: 20,
        wid: 'sc1-1',
      });
      prisma.wakaSpecTemplateSubChapterL2.aggregate.mockResolvedValue({
        _max: { order: 0 },
      });
      prisma.wakaSpecTemplateSubChapterL2.create.mockResolvedValue({
        id: 30,
        wid: 'sc2-1',
        title: 'Sub L2',
        order: 1,
      });

      const result = await service.addSubChapterL2('sc1-1', {
        title: 'Sub L2',
      });

      expect(result.order).toBe(1);
      expect(
        prisma.wakaSpecTemplateSubChapterL2.create,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            subChapterL1Id: 20,
            title: 'Sub L2',
            order: 1,
          }),
        }),
      );
    });

    it('should throw NotFoundException if L1 parent does not exist', async () => {
      prisma.wakaSpecTemplateSubChapterL1.findUnique.mockResolvedValue(
        null,
      );

      await expect(
        service.addSubChapterL2('unknown', { title: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── deleteSubChapterL2 ─────────────────────────────────────────

  describe('deleteSubChapterL2', () => {
    it('should delete L2 sub-chapter', async () => {
      prisma.wakaSpecTemplateSubChapterL2.findUnique.mockResolvedValue({
        id: 30,
        wid: 'sc2-1',
      });
      prisma.wakaSpecTemplateSubChapterL2.delete.mockResolvedValue({
        id: 30,
        wid: 'sc2-1',
      });

      const result = await service.deleteSubChapterL2('sc2-1');

      expect(result).toEqual({ id: 30, wid: 'sc2-1' });
    });

    it('should throw NotFoundException if L2 does not exist', async () => {
      prisma.wakaSpecTemplateSubChapterL2.findUnique.mockResolvedValue(
        null,
      );

      await expect(
        service.deleteSubChapterL2('unknown'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
