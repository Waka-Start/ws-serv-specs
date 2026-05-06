// Mocks virtuels pnpm strict
jest.mock('pg', () => ({ Pool: jest.fn() }), { virtual: true });
jest.mock('@prisma/adapter-pg', () => ({ PrismaPg: jest.fn() }), { virtual: true });
jest.mock('@prisma/client', () => ({ PrismaClient: jest.fn() }), { virtual: true });

import { Test, TestingModule } from '@nestjs/testing';
import { SpecificationsService } from './specifications.service';
import { PrismaService } from '../../prisma/prisma.service';
import { TemplatesService } from '../templates/templates.service';
import { NotFoundException } from '@nestjs/common';

const mockTemplatesService = {
  findOne: jest.fn(),
};

const mockPrismaService = {
  wakaSpecification: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  wakaSpecChapterContent: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    aggregate: jest.fn(),
  },
  $transaction: jest.fn(),
};

describe('SpecificationsService', () => {
  let service: SpecificationsService;
  let prisma: typeof mockPrismaService;
  let templatesService: typeof mockTemplatesService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SpecificationsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: TemplatesService, useValue: mockTemplatesService },
      ],
    }).compile();

    service = module.get<SpecificationsService>(SpecificationsService);
    prisma = module.get(PrismaService);
    templatesService = module.get(TemplatesService);
  });

  // ── findAll ─────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return specifications list', async () => {
      const specs = [
        { id: 1, wid: 'spec-1', name: 'Spec 1', chapters: [] },
      ];
      prisma.wakaSpecification.findMany.mockResolvedValue(specs);

      const result = await service.findAll({});

      expect(result).toEqual(specs);
      expect(prisma.wakaSpecification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
          orderBy: { createdAt: 'desc' },
        }),
      );
    });

    it('should apply projectId filter', async () => {
      prisma.wakaSpecification.findMany.mockResolvedValue([]);

      await service.findAll({ projectId: 'proj-1' });

      expect(prisma.wakaSpecification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { projectId: 'proj-1' },
        }),
      );
    });

    it('should apply stepId filter', async () => {
      prisma.wakaSpecification.findMany.mockResolvedValue([]);

      await service.findAll({ stepId: 'step-1' });

      expect(prisma.wakaSpecification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { stepId: 'step-1' },
        }),
      );
    });
  });

  // ── findOne ─────────────────────────────────────────────────────

  describe('findOne', () => {
    it('should return specification with chapters', async () => {
      const spec = {
        id: 1,
        wid: 'spec-1',
        name: 'Spec',
        chapters: [
          { id: 10, chapterWid: 'ch-1', chapterTitle: 'Intro' },
        ],
      };
      prisma.wakaSpecification.findUnique.mockResolvedValue(spec);

      const result = await service.findOne('spec-1');

      expect(result).toEqual(spec);
    });

    it('should throw NotFoundException for unknown wid', async () => {
      prisma.wakaSpecification.findUnique.mockResolvedValue(null);

      await expect(service.findOne('unknown')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── create ──────────────────────────────────────────────────────

  describe('create', () => {
    it('should initialize chapters from template via $transaction', async () => {
      const template = {
        id: 1,
        wid: 'tpl-1',
        chapters: [
          { wid: 'ch-1', title: 'Chapter 1', order: 0 },
          { wid: 'ch-2', title: 'Chapter 2', order: 1 },
        ],
      };
      templatesService.findOne.mockResolvedValue(template);

      const createdSpec = {
        id: 100,
        wid: 'spec-new',
        name: 'New Spec',
        chapters: [
          { chapterWid: 'ch-1', chapterTitle: 'Chapter 1' },
          { chapterWid: 'ch-2', chapterTitle: 'Chapter 2' },
        ],
      };

      // $transaction receives a callback - we need to execute it
      prisma.$transaction.mockImplementation(async (callback: Function) => {
        const tx = {
          wakaSpecification: {
            create: jest.fn().mockResolvedValue({ id: 100 }),
            findUnique: jest.fn().mockResolvedValue(createdSpec),
          },
          wakaSpecChapterContent: {
            createMany: jest.fn().mockResolvedValue({ count: 2 }),
          },
        };
        return callback(tx);
      });

      const dto = {
        templateWid: 'tpl-1',
        projectId: 'proj-1',
        name: 'New Spec',
        createdBy: 'user-1',
      };

      const result = await service.create(dto);

      expect(result).toEqual(createdSpec);
      expect(templatesService.findOne).toHaveBeenCalledWith('tpl-1');
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('should handle template with no chapters', async () => {
      const template = {
        id: 1,
        wid: 'tpl-1',
        chapters: [],
      };
      templatesService.findOne.mockResolvedValue(template);

      const createdSpec = { id: 100, wid: 'spec-new', chapters: [] };

      prisma.$transaction.mockImplementation(async (callback: Function) => {
        const tx = {
          wakaSpecification: {
            create: jest.fn().mockResolvedValue({ id: 100 }),
            findUnique: jest.fn().mockResolvedValue(createdSpec),
          },
          wakaSpecChapterContent: {
            createMany: jest.fn(),
          },
        };
        return callback(tx);
      });

      const result = await service.create({
        templateWid: 'tpl-1',
        projectId: 'proj-1',
        name: 'Empty',
        createdBy: 'user-1',
      });

      expect(result).toEqual(createdSpec);
    });
  });

  // ── update ──────────────────────────────────────────────────────

  describe('update', () => {
    it('should update specification metadata', async () => {
      const existing = {
        id: 1,
        wid: 'spec-1',
        name: 'Old Name',
        version: 1,
        chapters: [],
      };
      prisma.wakaSpecification.findUnique.mockResolvedValue(existing);

      const updated = { ...existing, name: 'New Name' };
      prisma.wakaSpecification.update.mockResolvedValue(updated);

      const result = await service.update('spec-1', { name: 'New Name' });

      expect(result.name).toBe('New Name');
    });

    it('should recalculate progress when status is updated', async () => {
      const existing = {
        id: 1,
        wid: 'spec-1',
        name: 'Spec',
        version: 1,
        chapters: [],
      };
      prisma.wakaSpecification.findUnique.mockResolvedValue(existing);

      const afterUpdate = { ...existing, status: 'IN_PROGRESS' };
      prisma.wakaSpecification.update.mockResolvedValue(afterUpdate);

      // recalculateGlobalProgress calls
      prisma.wakaSpecChapterContent.findMany.mockResolvedValue([
        { progress: 50 },
        { progress: 80 },
      ]);

      await service.update('spec-1', {
        status: 'IN_PROGRESS',
        updatedBy: 'user-1',
      });

      // update is called twice: once for the main update, once for progress recalc
      expect(prisma.wakaSpecification.update).toHaveBeenCalledTimes(2);
    });
  });

  // ── softDelete ──────────────────────────────────────────────────

  describe('softDelete', () => {
    it('should delete specification and return confirmation', async () => {
      const existing = {
        id: 1,
        wid: 'spec-1',
        name: 'Spec',
        chapters: [],
      };
      prisma.wakaSpecification.findUnique.mockResolvedValue(existing);
      prisma.wakaSpecification.delete.mockResolvedValue(existing);

      const result = await service.softDelete('spec-1');

      expect(result).toEqual({ deleted: true, wid: 'spec-1' });
    });
  });

  // ── getChapterContent ───────────────────────────────────────────

  describe('getChapterContent', () => {
    it('should return chapter content', async () => {
      const spec = { id: 1, wid: 'spec-1', chapters: [] };
      prisma.wakaSpecification.findUnique.mockResolvedValue(spec);

      const chapter = {
        id: 10,
        chapterWid: 'ch-1',
        content: 'Some content',
      };
      prisma.wakaSpecChapterContent.findFirst.mockResolvedValue(chapter);

      const result = await service.getChapterContent('spec-1', 'ch-1');

      expect(result).toEqual(chapter);
    });

    it('should throw NotFoundException if chapter not found', async () => {
      const spec = { id: 1, wid: 'spec-1', chapters: [] };
      prisma.wakaSpecification.findUnique.mockResolvedValue(spec);
      prisma.wakaSpecChapterContent.findFirst.mockResolvedValue(null);

      await expect(
        service.getChapterContent('spec-1', 'unknown'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── updateChapterContent ────────────────────────────────────────

  describe('updateChapterContent', () => {
    it('should update content and recalculate progress', async () => {
      const spec = { id: 1, wid: 'spec-1', chapters: [] };
      prisma.wakaSpecification.findUnique.mockResolvedValue(spec);

      const existingChapter = {
        id: 10,
        chapterWid: 'ch-1',
        content: 'Old',
        specificationId: 1,
      };
      prisma.wakaSpecChapterContent.findFirst.mockResolvedValue(
        existingChapter,
      );
      prisma.wakaSpecChapterContent.update.mockResolvedValue({
        ...existingChapter,
        content: 'New content',
      });

      // recalculateGlobalProgress
      prisma.wakaSpecChapterContent.findMany.mockResolvedValue([
        { progress: 100 },
      ]);
      prisma.wakaSpecification.update.mockResolvedValue({
        ...spec,
        globalProgress: 100,
        chapters: [],
      });

      const result = await service.updateChapterContent('spec-1', 'ch-1', {
        content: 'New content',
      });

      expect(prisma.wakaSpecChapterContent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 10 },
          data: expect.objectContaining({ content: 'New content' }),
        }),
      );
      // recalculate is called
      expect(prisma.wakaSpecChapterContent.findMany).toHaveBeenCalled();
    });
  });

  // ── exportMarkdown ──────────────────────────────────────────────

  describe('exportMarkdown', () => {
    it('should assemble chapters in order as markdown', async () => {
      const spec = {
        id: 1,
        wid: 'spec-1',
        template: {
          title: 'Template Title',
          docDescription: 'Template description',
        },
        chapters: [
          {
            chapterTitle: 'Introduction',
            chapterOrder: 0,
            content: 'Intro content',
          },
          {
            chapterTitle: 'Details',
            chapterOrder: 1,
            content: 'Details content',
          },
        ],
      };
      prisma.wakaSpecification.findUnique.mockResolvedValue(spec);

      const result = await service.exportMarkdown('spec-1');

      expect(result).toContain('# Template Title');
      expect(result).toContain('Template description');
      expect(result).toContain('## Introduction');
      expect(result).toContain('Intro content');
      expect(result).toContain('## Details');
      expect(result).toContain('Details content');
    });

    it('should throw NotFoundException for unknown spec', async () => {
      prisma.wakaSpecification.findUnique.mockResolvedValue(null);

      await expect(service.exportMarkdown('unknown')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should handle chapters with no content', async () => {
      const spec = {
        id: 1,
        wid: 'spec-1',
        template: {
          title: 'T',
          docDescription: 'D',
        },
        chapters: [
          {
            chapterTitle: 'Empty Chapter',
            chapterOrder: 0,
            content: null,
          },
        ],
      };
      prisma.wakaSpecification.findUnique.mockResolvedValue(spec);

      const result = await service.exportMarkdown('spec-1');

      expect(result).toContain('## Empty Chapter');
      expect(result).not.toContain('null');
    });
  });

  // ── saveVersion ─────────────────────────────────────────────────

  describe('saveVersion', () => {
    it('should increment version and return markdown', async () => {
      const spec = {
        id: 1,
        wid: 'spec-1',
        version: 2,
        chapters: [],
      };
      // findOne call
      prisma.wakaSpecification.findUnique.mockResolvedValueOnce(spec);
      // exportMarkdown call
      prisma.wakaSpecification.findUnique.mockResolvedValueOnce({
        ...spec,
        template: { title: 'T', docDescription: 'D' },
      });
      // update call
      prisma.wakaSpecification.update.mockResolvedValue({
        ...spec,
        version: 3,
      });

      const result = await service.saveVersion('spec-1');

      expect(result.version).toBe(3);
      expect(result.wid).toBe('spec-1');
      expect(result.markdown).toBeDefined();
      expect(prisma.wakaSpecification.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { version: 3 },
        }),
      );
    });
  });
});
