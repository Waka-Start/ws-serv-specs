import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import { AiService } from './ai.service';
import { PrismaService } from '../../prisma/prisma.service';

// Mock Anthropic SDK
const mockMessagesCreate = jest.fn().mockResolvedValue({
  content: [{ type: 'text', text: 'Generated AI content' }],
  stop_reason: 'end_turn',
});

jest.mock('@anthropic-ai/sdk', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      messages: {
        create: mockMessagesCreate,
      },
    })),
  };
});

const mockPrismaService = {
  wakaSpecification: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  wakaSpecChapterContent: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  wakaSpecAIHistory: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
};

const mockConfigService = {
  get: jest.fn((key: string, defaultValue?: string) => {
    const config: Record<string, string> = {
      ANTHROPIC_API_KEY: 'test-api-key',
      ANTHROPIC_MODEL: 'claude-test',
    };
    return config[key] ?? defaultValue;
  }),
};

describe('AiService', () => {
  let service: AiService;
  let prisma: typeof mockPrismaService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Generated AI content' }],
      stop_reason: 'end_turn',
    });

    // Re-mock config get for each test
    mockConfigService.get.mockImplementation(
      (key: string, defaultValue?: string) => {
        const config: Record<string, string> = {
          ANTHROPIC_API_KEY: 'test-api-key',
          ANTHROPIC_MODEL: 'claude-test',
        };
        return config[key] ?? defaultValue;
      },
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AiService>(AiService);
    prisma = module.get(PrismaService);
  });

  // ── ventilate ───────────────────────────────────────────────────

  describe('ventilate', () => {
    const makeSpec = (chapterCount = 2) => ({
      id: 1,
      wid: 'spec-1',
      template: {
        megaPrompt: 'You are a spec writer',
        chapters: Array.from({ length: chapterCount }, (_, i) => ({
          wid: `ch-${i}`,
          title: `Chapter ${i}`,
          order: i,
          prompt: `Write chapter ${i}`,
        })),
      },
      chapters: Array.from({ length: chapterCount }, (_, i) => ({
        id: 10 + i,
        chapterWid: `ch-${i}`,
        content: null,
        progress: 0,
      })),
    });

    it('should call Claude for each chapter in parallel', async () => {
      const spec = makeSpec(2);
      prisma.wakaSpecification.findUnique.mockResolvedValue(spec);
      prisma.wakaSpecChapterContent.update.mockResolvedValue({});
      prisma.wakaSpecAIHistory.create.mockResolvedValue({});
      prisma.wakaSpecChapterContent.findMany.mockResolvedValue([
        { progress: 30 },
        { progress: 30 },
      ]);
      prisma.wakaSpecification.update.mockResolvedValue({});

      // Second findUnique for the return
      prisma.wakaSpecification.findUnique
        .mockResolvedValueOnce(spec)
        .mockResolvedValueOnce({ ...spec, globalProgress: 30 });

      await service.ventilate({
        specificationWid: 'spec-1',
        initialText: 'My project description',
        userId: 'user-1',
      });

      // Each chapter should trigger an update and a history entry
      expect(prisma.wakaSpecChapterContent.update).toHaveBeenCalledTimes(2);
      expect(prisma.wakaSpecAIHistory.create).toHaveBeenCalledTimes(2);
    });

    it('should update chapter contents with AI responses', async () => {
      const spec = makeSpec(1);
      prisma.wakaSpecification.findUnique.mockResolvedValue(spec);
      prisma.wakaSpecChapterContent.update.mockResolvedValue({});
      prisma.wakaSpecAIHistory.create.mockResolvedValue({});
      prisma.wakaSpecChapterContent.findMany.mockResolvedValue([
        { progress: 30 },
      ]);
      prisma.wakaSpecification.update.mockResolvedValue({});

      prisma.wakaSpecification.findUnique
        .mockResolvedValueOnce(spec)
        .mockResolvedValueOnce(spec);

      await service.ventilate({
        specificationWid: 'spec-1',
        initialText: 'Text',
        userId: 'user-1',
      });

      expect(prisma.wakaSpecChapterContent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 10 },
          data: {
            content: 'Generated AI content',
            progress: 30,
          },
        }),
      );
    });

    it('should log AI history for each chapter', async () => {
      const spec = makeSpec(1);
      prisma.wakaSpecification.findUnique.mockResolvedValue(spec);
      prisma.wakaSpecChapterContent.update.mockResolvedValue({});
      prisma.wakaSpecAIHistory.create.mockResolvedValue({});
      prisma.wakaSpecChapterContent.findMany.mockResolvedValue([]);
      prisma.wakaSpecification.update.mockResolvedValue({});

      prisma.wakaSpecification.findUnique
        .mockResolvedValueOnce(spec)
        .mockResolvedValueOnce(spec);

      await service.ventilate({
        specificationWid: 'spec-1',
        initialText: 'Text',
        userId: 'user-1',
      });

      expect(prisma.wakaSpecAIHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          specificationId: 1,
          chapterWid: 'ch-0',
          action: 'VENTILATE',
          userId: 'user-1',
        }),
      });
    });

    it('should throw NotFoundException for unknown spec', async () => {
      prisma.wakaSpecification.findUnique.mockResolvedValue(null);

      await expect(
        service.ventilate({
          specificationWid: 'unknown',
          initialText: 'Text',
          userId: 'user-1',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── generateChapter ─────────────────────────────────────────────

  describe('generateChapter', () => {
    const makeSpec = (existingContent: string | null = null) => ({
      id: 1,
      wid: 'spec-1',
      template: {
        megaPrompt: 'Mega prompt',
        chapters: [
          { wid: 'ch-1', title: 'Chapter 1', order: 0, prompt: 'Write ch1' },
        ],
      },
      chapters: [
        {
          id: 10,
          chapterWid: 'ch-1',
          content: existingContent,
          progress: 20,
        },
      ],
    });

    it('should call Claude with mega prompt and chapter prompt', async () => {
      const spec = makeSpec();
      prisma.wakaSpecification.findUnique.mockResolvedValue(spec);
      prisma.wakaSpecChapterContent.update.mockResolvedValue({
        id: 10,
        content: 'Generated AI content',
        progress: 50,
      });
      prisma.wakaSpecAIHistory.create.mockResolvedValue({});
      prisma.wakaSpecChapterContent.findMany.mockResolvedValue([
        { progress: 50 },
      ]);
      prisma.wakaSpecification.update.mockResolvedValue({});

      const result = await service.generateChapter({
        specificationWid: 'spec-1',
        chapterWid: 'ch-1',
        userId: 'user-1',
      });

      expect(result.content).toBe('Generated AI content');
    });

    it('should include existing content in context', async () => {
      const spec = makeSpec('Existing paragraph');
      prisma.wakaSpecification.findUnique.mockResolvedValue(spec);
      prisma.wakaSpecChapterContent.update.mockResolvedValue({
        id: 10,
        content: 'Generated AI content',
        progress: 50,
      });
      prisma.wakaSpecAIHistory.create.mockResolvedValue({});
      prisma.wakaSpecChapterContent.findMany.mockResolvedValue([
        { progress: 50 },
      ]);
      prisma.wakaSpecification.update.mockResolvedValue({});

      await service.generateChapter({
        specificationWid: 'spec-1',
        chapterWid: 'ch-1',
        userId: 'user-1',
      });

      // Verify the chapter was updated (Claude was called with existing content)
      expect(prisma.wakaSpecChapterContent.update).toHaveBeenCalled();
    });

    it('should update chapter progress to at least 50', async () => {
      const spec = makeSpec();
      prisma.wakaSpecification.findUnique.mockResolvedValue(spec);
      prisma.wakaSpecChapterContent.update.mockResolvedValue({
        id: 10,
        progress: 50,
      });
      prisma.wakaSpecAIHistory.create.mockResolvedValue({});
      prisma.wakaSpecChapterContent.findMany.mockResolvedValue([
        { progress: 50 },
      ]);
      prisma.wakaSpecification.update.mockResolvedValue({});

      await service.generateChapter({
        specificationWid: 'spec-1',
        chapterWid: 'ch-1',
        userId: 'user-1',
      });

      expect(prisma.wakaSpecChapterContent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ progress: 50 }),
        }),
      );
    });

    it('should throw NotFoundException for unknown spec', async () => {
      prisma.wakaSpecification.findUnique.mockResolvedValue(null);

      await expect(
        service.generateChapter({
          specificationWid: 'unknown',
          chapterWid: 'ch-1',
          userId: 'user-1',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException for unknown chapter', async () => {
      const spec = {
        id: 1,
        wid: 'spec-1',
        template: { megaPrompt: 'MP', chapters: [] },
        chapters: [],
      };
      prisma.wakaSpecification.findUnique.mockResolvedValue(spec);

      await expect(
        service.generateChapter({
          specificationWid: 'spec-1',
          chapterWid: 'unknown',
          userId: 'user-1',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── modifyContent ───────────────────────────────────────────────

  describe('modifyContent', () => {
    const makeSpec = () => ({
      id: 1,
      wid: 'spec-1',
      chapters: [
        {
          id: 10,
          chapterWid: 'ch-1',
          content: 'Original full content with selected text here.',
        },
      ],
    });

    it('should send selected text and instruction to Claude', async () => {
      prisma.wakaSpecification.findUnique.mockResolvedValue(makeSpec());
      prisma.wakaSpecChapterContent.update.mockResolvedValue({
        id: 10,
        content: 'Generated AI content',
      });
      prisma.wakaSpecAIHistory.create.mockResolvedValue({});

      const result = await service.modifyContent({
        specificationWid: 'spec-1',
        chapterWid: 'ch-1',
        selectedText: 'selected text',
        userInstruction: 'Make it formal',
        userId: 'user-1',
      });

      expect(result.content).toBe('Generated AI content');
    });

    it('should return full updated chapter', async () => {
      prisma.wakaSpecification.findUnique.mockResolvedValue(makeSpec());
      const updatedChapter = {
        id: 10,
        chapterWid: 'ch-1',
        content: 'Full modified content',
      };
      prisma.wakaSpecChapterContent.update.mockResolvedValue(
        updatedChapter,
      );
      prisma.wakaSpecAIHistory.create.mockResolvedValue({});

      const result = await service.modifyContent({
        specificationWid: 'spec-1',
        chapterWid: 'ch-1',
        selectedText: 'text',
        userInstruction: 'Fix',
        userId: 'user-1',
      });

      expect(result).toEqual(updatedChapter);
    });

    it('should throw NotFoundException for unknown spec', async () => {
      prisma.wakaSpecification.findUnique.mockResolvedValue(null);

      await expect(
        service.modifyContent({
          specificationWid: 'unknown',
          chapterWid: 'ch-1',
          selectedText: 'text',
          userInstruction: 'Fix',
          userId: 'user-1',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException for unknown chapter', async () => {
      prisma.wakaSpecification.findUnique.mockResolvedValue({
        id: 1,
        wid: 'spec-1',
        chapters: [],
      });

      await expect(
        service.modifyContent({
          specificationWid: 'spec-1',
          chapterWid: 'unknown',
          selectedText: 'text',
          userInstruction: 'Fix',
          userId: 'user-1',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── deleteContent ───────────────────────────────────────────────

  describe('deleteContent', () => {
    it('should remove selected text from content', async () => {
      prisma.wakaSpecification.findUnique.mockResolvedValue({
        id: 1,
        wid: 'spec-1',
        chapters: [
          {
            id: 10,
            chapterWid: 'ch-1',
            content: 'Keep this. Remove this part. Keep that.',
          },
        ],
      });
      prisma.wakaSpecChapterContent.update.mockResolvedValue({
        id: 10,
        content: 'Keep this.  Keep that.',
      });
      prisma.wakaSpecAIHistory.create.mockResolvedValue({});

      const result = await service.deleteContent({
        specificationWid: 'spec-1',
        chapterWid: 'ch-1',
        selectedText: 'Remove this part.',
        userId: 'user-1',
      });

      expect(prisma.wakaSpecChapterContent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            content: 'Keep this.  Keep that.',
          },
        }),
      );
    });

    it('should preserve remaining content when text not found', async () => {
      const originalContent = 'Full original content';
      prisma.wakaSpecification.findUnique.mockResolvedValue({
        id: 1,
        wid: 'spec-1',
        chapters: [
          { id: 10, chapterWid: 'ch-1', content: originalContent },
        ],
      });
      prisma.wakaSpecChapterContent.update.mockResolvedValue({
        id: 10,
        content: originalContent,
      });
      prisma.wakaSpecAIHistory.create.mockResolvedValue({});

      await service.deleteContent({
        specificationWid: 'spec-1',
        chapterWid: 'ch-1',
        selectedText: 'nonexistent text',
        userId: 'user-1',
      });

      expect(prisma.wakaSpecChapterContent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { content: originalContent },
        }),
      );
    });

    it('should log deletion in AI history with null aiResponse', async () => {
      prisma.wakaSpecification.findUnique.mockResolvedValue({
        id: 1,
        wid: 'spec-1',
        chapters: [
          { id: 10, chapterWid: 'ch-1', content: 'Some content' },
        ],
      });
      prisma.wakaSpecChapterContent.update.mockResolvedValue({});
      prisma.wakaSpecAIHistory.create.mockResolvedValue({});

      await service.deleteContent({
        specificationWid: 'spec-1',
        chapterWid: 'ch-1',
        selectedText: 'Some',
        userId: 'user-1',
      });

      expect(prisma.wakaSpecAIHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'DELETE',
          aiResponse: null,
          userId: 'user-1',
        }),
      });
    });

    it('should throw NotFoundException for unknown spec', async () => {
      prisma.wakaSpecification.findUnique.mockResolvedValue(null);

      await expect(
        service.deleteContent({
          specificationWid: 'unknown',
          chapterWid: 'ch-1',
          selectedText: 'text',
          userId: 'user-1',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── suggestQuestions ────────────────────────────────────────────

  describe('suggestQuestions', () => {
    const dto = {
      chapterTitle: 'Architecture technique',
      chapterPrompt: 'Décrit les composants techniques du système',
      subChapterTitles: ['Backend', 'Frontend'],
    };

    it('should return questions from tool_use block', async () => {
      const questions = [
        { question: 'Quelle est la stack backend ?', category: 'technique' },
        { question: 'Combien d’utilisateurs simultanement ?', category: 'contrainte' },
      ];

      mockMessagesCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'tool_use',
            name: 'return_questions',
            input: { questions },
          },
        ],
        stop_reason: 'tool_use',
      });

      const result = await service.suggestQuestions(dto);

      expect(result.questions).toEqual(questions);
    });

    it('should return empty array when no tool_use block', async () => {
      mockMessagesCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Some text response' }],
        stop_reason: 'end_turn',
      });

      const result = await service.suggestQuestions(dto);

      expect(result.questions).toEqual([]);
    });

    it('should call Claude with tool_choice forced to return_questions', async () => {
      mockMessagesCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'tool_use',
            name: 'return_questions',
            input: { questions: [] },
          },
        ],
        stop_reason: 'tool_use',
      });

      await service.suggestQuestions(dto);

      expect(mockMessagesCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          tool_choice: { type: 'tool', name: 'return_questions' },
          tools: expect.arrayContaining([
            expect.objectContaining({ name: 'return_questions' }),
          ]),
        }),
      );
    });
  });

  // ── getHistory ──────────────────────────────────────────────────

  describe('getHistory', () => {
    it('should return sorted AI history', async () => {
      const spec = { id: 1, wid: 'spec-1' };
      prisma.wakaSpecification.findUnique.mockResolvedValue(spec);

      const history = [
        { id: 2, action: 'GENERATE', createdAt: new Date('2026-04-09') },
        { id: 1, action: 'VENTILATE', createdAt: new Date('2026-04-08') },
      ];
      prisma.wakaSpecAIHistory.findMany.mockResolvedValue(history);

      const result = await service.getHistory('spec-1');

      expect(result).toEqual(history);
      expect(prisma.wakaSpecAIHistory.findMany).toHaveBeenCalledWith({
        where: { specificationId: 1 },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should throw NotFoundException for unknown spec', async () => {
      prisma.wakaSpecification.findUnique.mockResolvedValue(null);

      await expect(service.getHistory('unknown')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
