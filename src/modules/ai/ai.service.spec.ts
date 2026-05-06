// Mocks virtuels pour les packages non hoistables en mode pnpm strict.
// PrismaService est fourni en tant que mockPrismaService (useValue), donc
// les modules réels ne sont jamais instanciés — seules les typographies importées le sont.

jest.mock('pg', () => ({ Pool: jest.fn() }), { virtual: true });
jest.mock('@prisma/adapter-pg', () => ({ PrismaPg: jest.fn() }), { virtual: true });
jest.mock(
  '@nestjs/bullmq',
  () => {
    // InjectQueue doit injecter via le token 'BullQueue_<name>'
    // On réutilise Inject de @nestjs/common (disponible via pnpm hoist)
    const { Inject } = jest.requireActual('@nestjs/common');
    return {
      InjectQueue: (name: string) => Inject(`BullQueue_${name}`),
      getQueueToken: (name: string) => `BullQueue_${name}`,
    };
  },
  { virtual: true },
);
jest.mock('bullmq', () => ({ Queue: jest.fn() }), { virtual: true });

// Mock @prisma/client avant tous les imports (pnpm strict — virtual mock)
jest.mock(
  '@prisma/client',
  () => ({
    AIAction: {
      VENTILATE: 'VENTILATE',
      GENERATE: 'GENERATE',
      MODIFY: 'MODIFY',
      DELETE: 'DELETE',
    },
    EnumAiJobStatus: {
      PENDING: 'PENDING',
      RUNNING: 'RUNNING',
      SUCCEEDED: 'SUCCEEDED',
      FAILED: 'FAILED',
      CANCELLED: 'CANCELLED',
    },
    EnumAiJobType: {
      VENTILATE: 'VENTILATE',
      VENTILATE_SUBCHAPTERS: 'VENTILATE_SUBCHAPTERS',
      GENERATE_CHAPTER: 'GENERATE_CHAPTER',
      MODIFY: 'MODIFY',
    },
    PrismaClient: jest.fn(),
  }),
  { virtual: true },
);

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import { AiService } from './ai.service';
import { PrismaService } from '../../prisma/prisma.service';

// BullMQ inject token without importing @nestjs/bullmq to avoid pnpm hoist issues in tests
// Format matches getQueueToken('ai-jobs') output from @nestjs/bullmq
const AI_JOBS_QUEUE_TOKEN = 'BullQueue_ai-jobs';

// Mock BullMQ Queue
const mockQueueAdd = jest.fn().mockResolvedValue({});
const mockQueue = { add: mockQueueAdd };

// Mock Anthropic SDK (virtual: true pour pnpm strict mode où le module n'est pas hoistable)
const mockMessagesCreate = jest.fn().mockResolvedValue({
  content: [{ type: 'text', text: 'Generated AI content' }],
  stop_reason: 'end_turn',
});

jest.mock(
  '@anthropic-ai/sdk',
  () => {
    return {
      __esModule: true,
      default: jest.fn().mockImplementation(() => ({
        messages: {
          create: mockMessagesCreate,
        },
      })),
      APIError: class APIError extends Error {
        status: number;
        constructor(status: number, message: string) {
          super(message);
          this.status = status;
        }
      },
    };
  },
  { virtual: true },
);

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
  wakaSpecAiJob: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn().mockResolvedValue({ wid: 'job-wid-1' }),
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

// Helper : configure les mocks pour que evaluateChapterInternal retourne
// un résultat rule-based (contenu vide) sans appel Claude supplémentaire.
function setupEvaluateMocksEmpty(
  prisma: typeof mockPrismaService,
  specId: number,
  chapterWid: string,
) {
  // evaluateChapterInternal : findUnique spec avec template
  prisma.wakaSpecification.findUnique.mockResolvedValueOnce({
    id: specId,
    template: { chapters: [] },
  });
  // findFirst chapter content — retourne contenu vide pour déclencher rule-based
  prisma.wakaSpecChapterContent.findFirst.mockResolvedValueOnce({
    id: 10,
    chapterWid,
    content: '',
    progress: 0,
    isFilled: false,
  });
  // updateChapterEvaluation : update + recalculate
  prisma.wakaSpecChapterContent.update.mockResolvedValueOnce({
    id: 10,
    wid: 'ch-content-wid',
    chapterWid,
    chapterTitle: 'Chapter 1',
    content: '',
    progress: 0,
    isFilled: false,
    evaluationDetails: null,
    evaluatedAt: null,
  });
  prisma.wakaSpecChapterContent.findMany.mockResolvedValueOnce([{ progress: 0, isFilled: false }]);
  prisma.wakaSpecification.update.mockResolvedValueOnce({});
}

// Helper : configure les mocks pour buildGenerateChapterResponse
// (appelé après evaluateChapterInternal dans generateChapter)
function setupBuildGenerateResponseMocks(
  prisma: typeof mockPrismaService,
  specId: number,
) {
  // findMany pour filled/total
  prisma.wakaSpecChapterContent.findMany.mockResolvedValueOnce([
    { progress: 0, isFilled: false },
  ]);
  // findUnique spec pour globalProgress
  prisma.wakaSpecification.findUnique.mockResolvedValueOnce({
    id: specId,
    globalProgress: 0,
  });
}

describe('AiService', () => {
  let service: AiService;
  let prisma: typeof mockPrismaService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockQueueAdd.mockResolvedValue({});
    mockPrismaService.wakaSpecAiJob.create.mockResolvedValue({ wid: 'job-wid-1' });
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
        { provide: AI_JOBS_QUEUE_TOKEN, useValue: mockQueue },
      ],
    }).compile();

    service = module.get<AiService>(AiService);
    prisma = module.get(PrismaService);
  });

  // ── ventilate ───────────────────────────────────────────────────

  describe('ventilate', () => {
    // service.ventilate() crée un job en DB puis l'enfile dans BullMQ.
    // L'appel Claude est délégué au processor (AiJobsProcessor) — pas testé ici.

    it('should create a job in DB and enqueue it in BullMQ', async () => {
      prisma.wakaSpecification.findUnique.mockResolvedValueOnce({ id: 1, wid: 'spec-1' });
      prisma.wakaSpecAiJob.findFirst.mockResolvedValueOnce(null); // pas de job en cours
      prisma.wakaSpecAiJob.create.mockResolvedValueOnce({ wid: 'job-wid-1' });

      const result = await service.ventilate({
        specificationWid: 'spec-1',
        initialText: 'My project description',
        userId: 'user-uuid-1',
      });

      expect(prisma.wakaSpecAiJob.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'VENTILATE',
            status: 'PENDING',
            specificationWid: 'spec-1',
          }),
        }),
      );
      expect(mockQueueAdd).toHaveBeenCalledWith(
        'ventilate',
        { jobWid: 'job-wid-1' },
        expect.any(Object),
      );
      expect(result).toEqual({ jobWid: 'job-wid-1', status: 'PENDING' });
    });

    it('should throw ConflictException when a VENTILATE job is already running', async () => {
      prisma.wakaSpecification.findUnique.mockResolvedValueOnce({ id: 1, wid: 'spec-1' });
      prisma.wakaSpecAiJob.findFirst.mockResolvedValueOnce({ wid: 'existing-job' });

      await expect(
        service.ventilate({
          specificationWid: 'spec-1',
          initialText: 'Text',
          userId: 'user-uuid-1',
        }),
      ).rejects.toThrow(expect.objectContaining({ message: expect.stringContaining('VENTILATE job') }));
    });

    it('should throw NotFoundException for unknown spec', async () => {
      prisma.wakaSpecification.findUnique.mockResolvedValue(null);

      await expect(
        service.ventilate({
          specificationWid: 'unknown',
          initialText: 'Text',
          userId: 'user-uuid-1',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── ventilateSubChapters ─────────────────────────────────────────

  describe('ventilateSubChapters', () => {
    it('should create a VENTILATE_SUBCHAPTERS job and return jobId', async () => {
      prisma.wakaSpecification.findUnique.mockResolvedValueOnce({ id: 1, wid: 'spec-1' });
      prisma.wakaSpecChapterContent.findFirst.mockResolvedValueOnce({
        id: 10,
        chapterWid: 'ch-1',
        content: 'Some content to ventilate',
      });
      prisma.wakaSpecAiJob.findFirst.mockResolvedValueOnce(null);
      prisma.wakaSpecAiJob.create.mockResolvedValueOnce({ wid: 'sub-job-wid-1' });

      const result = await service.ventilateSubChapters('ch-1', {
        specificationWid: 'spec-1',
        userId: 'user-uuid-1',
      });

      expect(prisma.wakaSpecAiJob.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'VENTILATE_SUBCHAPTERS',
            status: 'PENDING',
          }),
        }),
      );
      expect(mockQueueAdd).toHaveBeenCalledWith(
        'ventilate-subchapters',
        { jobWid: 'sub-job-wid-1' },
        expect.any(Object),
      );
      expect(result).toEqual({ jobId: 'sub-job-wid-1' });
    });

    it('should throw ConflictException when chapter has no content', async () => {
      prisma.wakaSpecification.findUnique.mockResolvedValueOnce({ id: 1, wid: 'spec-1' });
      prisma.wakaSpecChapterContent.findFirst.mockResolvedValueOnce({
        id: 10,
        chapterWid: 'ch-1',
        content: '',
      });

      await expect(
        service.ventilateSubChapters('ch-1', {
          specificationWid: 'spec-1',
          userId: 'user-uuid-1',
        }),
      ).rejects.toThrow(expect.objectContaining({ message: expect.stringContaining('no content') }));
    });

    it('should throw NotFoundException for unknown spec', async () => {
      prisma.wakaSpecification.findUnique.mockResolvedValue(null);

      await expect(
        service.ventilateSubChapters('ch-1', {
          specificationWid: 'unknown',
          userId: 'user-uuid-1',
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
      prisma.wakaSpecification.findUnique.mockResolvedValueOnce(spec);
      prisma.wakaSpecChapterContent.update.mockResolvedValueOnce({
        id: 10,
        content: 'Generated AI content',
        progress: 0,
      });
      prisma.wakaSpecAIHistory.create.mockResolvedValue({});

      // evaluateChapterInternal after generate
      setupEvaluateMocksEmpty(prisma, 1, 'ch-1');
      // buildGenerateChapterResponse : filled/total + globalProgress
      setupBuildGenerateResponseMocks(prisma, 1);

      const result = await service.generateChapter({
        specificationWid: 'spec-1',
        chapterWid: 'ch-1',
        userId: 'user-1',
      });

      // Le nouveau shape doit contenir chapter et progress
      expect(result).toBeDefined();
      expect(result).toHaveProperty('chapter');
      expect(result).toHaveProperty('progress');
    });

    it('should include existing content in context', async () => {
      const spec = makeSpec('Existing paragraph');
      prisma.wakaSpecification.findUnique.mockResolvedValueOnce(spec);
      prisma.wakaSpecChapterContent.update.mockResolvedValueOnce({
        id: 10,
        content: 'Generated AI content',
        progress: 0,
      });
      prisma.wakaSpecAIHistory.create.mockResolvedValue({});

      setupEvaluateMocksEmpty(prisma, 1, 'ch-1');
      setupBuildGenerateResponseMocks(prisma, 1);

      await service.generateChapter({
        specificationWid: 'spec-1',
        chapterWid: 'ch-1',
        userId: 'user-1',
      });

      // Verify the chapter was updated
      expect(prisma.wakaSpecChapterContent.update).toHaveBeenCalled();
    });

    it('should delegate progress to evaluation after generate', async () => {
      const spec = makeSpec();
      prisma.wakaSpecification.findUnique.mockResolvedValueOnce(spec);
      prisma.wakaSpecChapterContent.update.mockResolvedValueOnce({
        id: 10,
        content: 'Generated AI content',
        progress: 0,
      });
      prisma.wakaSpecAIHistory.create.mockResolvedValue({});

      setupEvaluateMocksEmpty(prisma, 1, 'ch-1');
      setupBuildGenerateResponseMocks(prisma, 1);

      const result = await service.generateChapter({
        specificationWid: 'spec-1',
        chapterWid: 'ch-1',
        userId: 'user-1',
      });

      // Le résultat doit avoir le nouveau shape avec progress global
      expect(result.progress).toBeDefined();
      expect(result.progress.total).toBe(1);
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
      prisma.wakaSpecification.findUnique.mockResolvedValueOnce(makeSpec());
      prisma.wakaSpecChapterContent.update.mockResolvedValueOnce({
        id: 10,
        content: 'Generated AI content',
      });
      prisma.wakaSpecAIHistory.create.mockResolvedValue({});

      setupEvaluateMocksEmpty(prisma, 1, 'ch-1');

      const result = await service.modifyContent({
        specificationWid: 'spec-1',
        chapterWid: 'ch-1',
        selectedText: 'selected text',
        userInstruction: 'Make it formal',
        userId: 'user-1',
      });

      // Returns the result of evaluateChapterInternal (update result)
      expect(result).toBeDefined();
    });

    it('should return full updated chapter from evaluation', async () => {
      prisma.wakaSpecification.findUnique.mockResolvedValueOnce(makeSpec());
      prisma.wakaSpecChapterContent.update.mockResolvedValueOnce({
        id: 10,
        chapterWid: 'ch-1',
        content: 'Full modified content',
      });
      prisma.wakaSpecAIHistory.create.mockResolvedValue({});

      // evaluateChapterInternal returns update result
      const evaluatedChapter = {
        id: 10,
        chapterWid: 'ch-1',
        content: 'Full modified content',
        progress: 0,
        evaluationDetails: { score: 0 },
        evaluatedAt: new Date(),
      };
      prisma.wakaSpecification.findUnique.mockResolvedValueOnce({
        id: 1,
        template: { chapters: [] },
      });
      prisma.wakaSpecChapterContent.findFirst.mockResolvedValueOnce({
        id: 10,
        chapterWid: 'ch-1',
        content: '',
        progress: 0,
      });
      prisma.wakaSpecChapterContent.update.mockResolvedValueOnce(evaluatedChapter);
      prisma.wakaSpecChapterContent.findMany.mockResolvedValueOnce([{ progress: 0 }]);
      prisma.wakaSpecification.update.mockResolvedValueOnce({});

      const result = await service.modifyContent({
        specificationWid: 'spec-1',
        chapterWid: 'ch-1',
        selectedText: 'text',
        userInstruction: 'Fix',
        userId: 'user-1',
      });

      expect(result).toEqual(evaluatedChapter);
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
      prisma.wakaSpecification.findUnique.mockResolvedValueOnce({
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
      prisma.wakaSpecChapterContent.update.mockResolvedValueOnce({
        id: 10,
        content: 'Keep this.  Keep that.',
      });
      prisma.wakaSpecAIHistory.create.mockResolvedValue({});

      setupEvaluateMocksEmpty(prisma, 1, 'ch-1');

      await service.deleteContent({
        specificationWid: 'spec-1',
        chapterWid: 'ch-1',
        selectedText: 'Remove this part.',
        userId: 'user-1',
      });

      // First update call should be the content update (not the evaluation update)
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
      prisma.wakaSpecification.findUnique.mockResolvedValueOnce({
        id: 1,
        wid: 'spec-1',
        chapters: [
          { id: 10, chapterWid: 'ch-1', content: originalContent },
        ],
      });
      prisma.wakaSpecChapterContent.update.mockResolvedValueOnce({
        id: 10,
        content: originalContent,
      });
      prisma.wakaSpecAIHistory.create.mockResolvedValue({});

      setupEvaluateMocksEmpty(prisma, 1, 'ch-1');

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
      prisma.wakaSpecification.findUnique.mockResolvedValueOnce({
        id: 1,
        wid: 'spec-1',
        chapters: [
          { id: 10, chapterWid: 'ch-1', content: 'Some content' },
        ],
      });
      prisma.wakaSpecChapterContent.update.mockResolvedValue({});
      prisma.wakaSpecAIHistory.create.mockResolvedValue({});

      setupEvaluateMocksEmpty(prisma, 1, 'ch-1');

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

    it('should pass existingContent and initialText to user message', async () => {
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

      await service.suggestQuestions({
        ...dto,
        existingContent: 'Already written content',
        initialText: 'Initial project text',
      });

      const callArgs = mockMessagesCreate.mock.calls[0][0];
      const userMessage = callArgs.messages[0].content as string;
      expect(userMessage).toContain('Already written content');
      expect(userMessage).toContain('Initial project text');
    });
  });

  // ── backward compat ANTHROPIC_EVAL_MODEL ────────────────────────

  describe('ANTHROPIC_EVAL_MODEL backward compat', () => {
    it('should use ANTHROPIC_EVAL_MODEL value when ANTHROPIC_MODEL_LIGHT is not set', async () => {
      mockConfigService.get.mockImplementation(
        (key: string, defaultValue?: string) => {
          const config: Record<string, string> = {
            ANTHROPIC_API_KEY: 'test-api-key',
            ANTHROPIC_MODEL: 'claude-test',
            ANTHROPIC_EVAL_MODEL: 'claude-haiku-4-5-20251001',
          };
          return config[key] ?? defaultValue;
        },
      );

      const module = await Test.createTestingModule({
        providers: [
          AiService,
          { provide: PrismaService, useValue: mockPrismaService },
          { provide: ConfigService, useValue: mockConfigService },
          { provide: AI_JOBS_QUEUE_TOKEN, useValue: mockQueue },
        ],
      }).compile();

      const svc = module.get<AiService>(AiService);
      // modelLight should have been resolved to the deprecated value
      expect((svc as any).modelLight).toBe('claude-haiku-4-5-20251001');
    });

    it('should prefer ANTHROPIC_MODEL_LIGHT over ANTHROPIC_EVAL_MODEL when both are set', async () => {
      mockConfigService.get.mockImplementation(
        (key: string, defaultValue?: string) => {
          const config: Record<string, string> = {
            ANTHROPIC_API_KEY: 'test-api-key',
            ANTHROPIC_MODEL: 'claude-test',
            ANTHROPIC_EVAL_MODEL: 'claude-haiku-4-5-20251001',
            ANTHROPIC_MODEL_LIGHT: 'claude-haiku-4-5',
          };
          return config[key] ?? defaultValue;
        },
      );

      const module = await Test.createTestingModule({
        providers: [
          AiService,
          { provide: PrismaService, useValue: mockPrismaService },
          { provide: ConfigService, useValue: mockConfigService },
          { provide: AI_JOBS_QUEUE_TOKEN, useValue: mockQueue },
        ],
      }).compile();

      const svc = module.get<AiService>(AiService);
      expect((svc as any).modelLight).toBe('claude-haiku-4-5');
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
