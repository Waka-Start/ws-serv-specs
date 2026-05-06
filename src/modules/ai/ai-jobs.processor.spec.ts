// Mocks virtuels pour les packages non hoistables en mode pnpm strict.
jest.mock('pg', () => ({ Pool: jest.fn() }), { virtual: true });
jest.mock('@prisma/adapter-pg', () => ({ PrismaPg: jest.fn() }), { virtual: true });

jest.mock(
  '@nestjs/bullmq',
  () => {
    const { Inject } = jest.requireActual('@nestjs/common');
    return {
      Processor: () => () => {},
      WorkerHost: class WorkerHost {
        process(_job: unknown): Promise<void> {
          return Promise.resolve();
        }
      },
      InjectQueue: (name: string) => Inject(`BullQueue_${name}`),
      getQueueToken: (name: string) => `BullQueue_${name}`,
    };
  },
  { virtual: true },
);
jest.mock('bullmq', () => ({ Queue: jest.fn() }), { virtual: true });

jest.mock(
  '@prisma/client',
  () => ({
    AIAction: { VENTILATE: 'VENTILATE', GENERATE: 'GENERATE', MODIFY: 'MODIFY', DELETE: 'DELETE' },
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

jest.mock(
  '@anthropic-ai/sdk',
  () => {
    return {
      __esModule: true,
      default: jest.fn().mockImplementation(() => ({
        messages: { create: mockMessagesCreate },
      })),
    };
  },
  { virtual: true },
);

// mockMessagesCreate doit être accessible dans le mock factory — on le déclare avant
const mockMessagesCreate = jest.fn();

import { AiJobsProcessor, JobCancelledError } from './ai-jobs.processor';
import { PrismaService } from '../../prisma/prisma.service';
import { AiService } from './ai.service';
import { AiJobsService } from './ai-jobs.service';
import { Test } from '@nestjs/testing';

// Helpers pour construire les fixtures
function makeTemplateChapter(overrides: Partial<{
  wid: string;
  title: string;
  prompt: string;
  order: number;
  subChaptersL1: Array<{ wid: string; title: string; order: number; subChaptersL2: Array<{ wid: string; title: string; order: number }> }>;
}> = {}) {
  return {
    id: 1,
    wid: overrides.wid ?? 'ch-template-1',
    title: overrides.title ?? 'Chapter 1',
    prompt: overrides.prompt ?? 'Write ch1',
    order: overrides.order ?? 0,
    isVariable: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    templateId: 1,
    chapterId: 1,
    subChaptersL1: overrides.subChaptersL1 ?? [],
  };
}

function makeDbJob(overrides: Partial<{
  wid: string;
  status: string;
  input: Record<string, unknown>;
}> = {}) {
  return {
    id: 'job-uuid-1',
    wid: overrides.wid ?? 'job-1',
    type: 'VENTILATE',
    status: overrides.status ?? 'PENDING',
    specificationWid: 'spec-wid-1',
    userId: 'user-1',
    input: overrides.input ?? {
      specificationWid: 'spec-wid-1',
      initialText: 'My project description',
      userId: 'user-1',
    },
    progress: null,
    result: null,
    startedAt: null,
    finishedAt: null,
    inputTokens: 0,
    outputTokens: 0,
    estimatedCostCts: null,
    errorCode: null,
    errorMessage: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function makeSpecification(chapters: Array<{ wid: string; title: string; order: number; subChaptersL1?: unknown[] }>) {
  return {
    id: 42,
    wid: 'spec-wid-1',
    globalProgress: 0,
    template: {
      megaPrompt: 'system prompt',
      chapters: chapters.map((ch, idx) => makeTemplateChapter({
        wid: ch.wid,
        title: ch.title,
        order: ch.order,
        subChaptersL1: (ch.subChaptersL1 ?? []) as Array<{
          wid: string; title: string; order: number;
          subChaptersL2: Array<{ wid: string; title: string; order: number }>;
        }>,
      })),
    },
    chapters: chapters.map((ch, idx) => ({
      id: idx + 100,
      wid: `cc-${ch.wid}`,
      chapterWid: ch.wid,
      chapterTitle: ch.title,
      chapterOrder: ch.order,
      content: null,
      progress: 0,
      isFilled: false,
      specificationId: 42,
      isAutoSaved: false,
      evaluationDetails: null,
      evaluatedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
  };
}

function makeClaudeResponse(text: string) {
  return {
    content: [{ type: 'text', text }],
    stop_reason: 'end_turn',
    usage: { input_tokens: 100, output_tokens: 200 },
  };
}

// Mock PrismaService complet
const mockPrisma = {
  wakaSpecAiJob: {
    findUnique: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
  },
  wakaSpecification: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  wakaSpecChapterContent: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
    upsert: jest.fn(),
  },
  wakaSpecSubChapterContent: {
    upsert: jest.fn(),
  },
  wakaSpecAIHistory: {
    create: jest.fn(),
  },
};

const mockAiService = {
  model: 'claude-test',
  anthropic: {
    messages: { create: mockMessagesCreate },
  },
};

const mockAiJobsService = {
  cleanStaleJobs: jest.fn(),
};

describe('AiJobsProcessor', () => {
  let processor: AiJobsProcessor;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockMessagesCreate.mockResolvedValue(makeClaudeResponse('Generated chapter content with some length'));
    mockPrisma.wakaSpecAiJob.update.mockResolvedValue({});
    mockPrisma.wakaSpecification.update.mockResolvedValue({});
    mockPrisma.wakaSpecChapterContent.update.mockResolvedValue({});
    mockPrisma.wakaSpecChapterContent.create.mockResolvedValue({ id: 100 });
    mockPrisma.wakaSpecAIHistory.create.mockResolvedValue({});
    mockPrisma.wakaSpecChapterContent.findMany.mockResolvedValue([]);

    const module = await Test.createTestingModule({
      providers: [
        AiJobsProcessor,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AiService, useValue: mockAiService },
        { provide: AiJobsService, useValue: mockAiJobsService },
      ],
    }).compile();

    processor = module.get<AiJobsProcessor>(AiJobsProcessor);
  });

  // ── process() dispatch ──────────────────────────────────────────

  describe('process() dispatch', () => {
    it('should call cleanStaleJobs for cleanup-stale-jobs job name', async () => {
      const job = { name: 'cleanup-stale-jobs', data: {} } as any;
      await processor.process(job);
      expect(mockAiJobsService.cleanStaleJobs).toHaveBeenCalled();
    });

    it('should warn and skip unknown job names', async () => {
      const job = { name: 'unknown-job', data: { jobWid: 'j1' } } as any;
      mockPrisma.wakaSpecAiJob.findUnique.mockResolvedValue(null);
      // Should not throw
      await processor.process(job);
    });

    it('should skip when jobWid is missing', async () => {
      const job = { name: 'ventilate', data: {} } as any;
      await processor.process(job);
      expect(mockPrisma.wakaSpecAiJob.findUnique).not.toHaveBeenCalled();
    });
  });

  // ── processVentilate — chapitres sans sous-chapitres ───────────

  describe('processVentilate — chapters only (no sub-chapters)', () => {
    it('should mark job RUNNING then SUCCEEDED and write chapter content', async () => {
      const spec = makeSpecification([
        { wid: 'ch-1', title: 'Chapter 1', order: 0 },
        { wid: 'ch-2', title: 'Chapter 2', order: 1 },
      ]);

      const dbJob = makeDbJob();

      mockPrisma.wakaSpecAiJob.findUnique
        .mockResolvedValueOnce(dbJob) // initial load
        .mockResolvedValueOnce({ status: 'RUNNING' }) // cancellation check step 1
        .mockResolvedValueOnce({ status: 'RUNNING' }); // cancellation check step 2

      mockPrisma.wakaSpecification.findUnique.mockResolvedValue(spec);
      mockPrisma.wakaSpecChapterContent.update.mockResolvedValue({ id: 100 });
      mockPrisma.wakaSpecChapterContent.findMany.mockResolvedValue([
        { progress: 50, isFilled: true },
        { progress: 50, isFilled: true },
      ]);

      const job = { name: 'ventilate', data: { jobWid: 'job-1' } } as any;
      await processor.process(job);

      // RUNNING transition
      expect(mockPrisma.wakaSpecAiJob.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'RUNNING' }),
        }),
      );

      // SUCCEEDED transition — last call
      const calls = mockPrisma.wakaSpecAiJob.update.mock.calls;
      const succeededCall = calls.find(
        (c: unknown[]) => (c[0] as any).data?.status === 'SUCCEEDED',
      );
      expect(succeededCall).toBeDefined();
      const resultData = (succeededCall![0] as any).data.result;
      expect(resultData.chapters).toHaveLength(2);
      expect(resultData.subChapters).toHaveLength(0);
      expect(resultData.progress).toEqual(
        expect.objectContaining({ total: 2 }),
      );
    });

    it('should write chapter content via update when chapterContent exists', async () => {
      const spec = makeSpecification([{ wid: 'ch-1', title: 'Ch1', order: 0 }]);

      mockPrisma.wakaSpecAiJob.findUnique
        .mockResolvedValueOnce(makeDbJob())
        .mockResolvedValueOnce({ status: 'RUNNING' });
      mockPrisma.wakaSpecification.findUnique.mockResolvedValue(spec);
      mockPrisma.wakaSpecChapterContent.findMany.mockResolvedValue([{ progress: 50, isFilled: true }]);

      await processor.process({ name: 'ventilate', data: { jobWid: 'job-1' } } as any);

      expect(mockPrisma.wakaSpecChapterContent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 100 }, // id from spec.chapters[0].id
          data: expect.objectContaining({ content: expect.any(String), isFilled: expect.any(Boolean) }),
        }),
      );
    });

    it('should create fallback chapterContent row when not found in spec', async () => {
      const spec = makeSpecification([{ wid: 'ch-1', title: 'Ch1', order: 0 }]);
      // Patch: spec has no matching chapterContent for ch-1
      spec.chapters = []; // empty so find() returns undefined

      mockPrisma.wakaSpecAiJob.findUnique
        .mockResolvedValueOnce(makeDbJob())
        .mockResolvedValueOnce({ status: 'RUNNING' });
      mockPrisma.wakaSpecification.findUnique.mockResolvedValue(spec);
      mockPrisma.wakaSpecChapterContent.create.mockResolvedValue({ id: 999 });
      mockPrisma.wakaSpecChapterContent.findMany.mockResolvedValue([{ progress: 0, isFilled: false }]);

      await processor.process({ name: 'ventilate', data: { jobWid: 'job-1' } } as any);

      expect(mockPrisma.wakaSpecChapterContent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            chapterWid: 'ch-1',
            content: expect.any(String),
          }),
        }),
      );
    });

    it('should call Claude once per chapter', async () => {
      const spec = makeSpecification([
        { wid: 'ch-1', title: 'Ch1', order: 0 },
        { wid: 'ch-2', title: 'Ch2', order: 1 },
        { wid: 'ch-3', title: 'Ch3', order: 2 },
      ]);

      mockPrisma.wakaSpecAiJob.findUnique
        .mockResolvedValueOnce(makeDbJob())
        .mockResolvedValue({ status: 'RUNNING' });
      mockPrisma.wakaSpecification.findUnique.mockResolvedValue(spec);
      mockPrisma.wakaSpecChapterContent.findMany.mockResolvedValue([
        { progress: 40, isFilled: true },
        { progress: 40, isFilled: true },
        { progress: 40, isFilled: true },
      ]);

      await processor.process({ name: 'ventilate', data: { jobWid: 'job-1' } } as any);

      expect(mockMessagesCreate).toHaveBeenCalledTimes(3);
    });
  });

  // ── processVentilate — cascade sous-chapitres ──────────────────

  describe('processVentilate — cascade sub-chapters', () => {
    function makeSpecWithSubChapters() {
      const subChaptersL1 = [
        {
          wid: 'sc-l1-1',
          title: 'Sub 1.1',
          order: 0,
          subChaptersL2: [],
        },
        {
          wid: 'sc-l1-2',
          title: 'Sub 1.2',
          order: 1,
          subChaptersL2: [
            { wid: 'sc-l2-1', title: 'L2 A', order: 0 },
            { wid: 'sc-l2-2', title: 'L2 B', order: 1 },
          ],
        },
      ];

      return makeSpecification([
        { wid: 'ch-1', title: 'Chapter 1', order: 0, subChaptersL1 },
      ]);
    }

    it('should call Claude for parent chapter AND for sub-chapter ventilation', async () => {
      const spec = makeSpecWithSubChapters();

      mockPrisma.wakaSpecAiJob.findUnique
        .mockResolvedValueOnce(makeDbJob())
        .mockResolvedValueOnce({ status: 'RUNNING' }); // cancellation check

      mockPrisma.wakaSpecification.findUnique.mockResolvedValue(spec);

      // Claude returns valid JSON for sub-chapter ventilation
      const subChapterJson = JSON.stringify([
        { index: 1, content: 'Content for sub 1.1 which is long enough to count' },
        { index: 2, content: 'Content for L2 A which is also long enough' },
        { index: 3, content: 'Content for L2 B which is also long enough' },
      ]);
      mockMessagesCreate
        .mockResolvedValueOnce(makeClaudeResponse('Chapter 1 main content long enough')) // parent
        .mockResolvedValueOnce(makeClaudeResponse(subChapterJson)); // sub-chapters

      mockPrisma.wakaSpecSubChapterContent.upsert.mockResolvedValue({
        id: 1,
        wid: 'sc-content-1',
        subChapterL1Wid: 'sc-l1-1',
        subChapterL2Wid: '',
        title: 'Sub 1.1',
        content: 'Content for sub 1.1',
        progress: 30,
        order: 0,
      });

      mockPrisma.wakaSpecChapterContent.findMany.mockResolvedValue([
        { progress: 50, isFilled: true },
      ]);

      await processor.process({ name: 'ventilate', data: { jobWid: 'job-1' } } as any);

      // 2 Claude calls : 1 pour le parent, 1 pour la ventilation sous-chapitres
      expect(mockMessagesCreate).toHaveBeenCalledTimes(2);
    });

    it('should upsert sub-chapter content rows for each slot', async () => {
      const spec = makeSpecWithSubChapters();
      // 3 slots : sc-l1-1 (L1 direct) + sc-l1-2/sc-l2-1 + sc-l1-2/sc-l2-2

      mockPrisma.wakaSpecAiJob.findUnique
        .mockResolvedValueOnce(makeDbJob())
        .mockResolvedValueOnce({ status: 'RUNNING' });

      mockPrisma.wakaSpecification.findUnique.mockResolvedValue(spec);

      const subChapterJson = JSON.stringify([
        { index: 1, content: 'Content A long enough for threshold' },
        { index: 2, content: 'Content B long enough for threshold' },
        { index: 3, content: 'Content C long enough for threshold' },
      ]);
      mockMessagesCreate
        .mockResolvedValueOnce(makeClaudeResponse('Chapter main content'))
        .mockResolvedValueOnce(makeClaudeResponse(subChapterJson));

      const upsertedRecord = {
        id: 1,
        wid: 'sc-1',
        subChapterL1Wid: 'sc-l1-1',
        subChapterL2Wid: '',
        title: 'Sub 1.1',
        content: 'Content A',
        progress: 20,
        order: 0,
      };
      mockPrisma.wakaSpecSubChapterContent.upsert.mockResolvedValue(upsertedRecord);
      mockPrisma.wakaSpecChapterContent.findMany.mockResolvedValue([{ progress: 50, isFilled: true }]);

      await processor.process({ name: 'ventilate', data: { jobWid: 'job-1' } } as any);

      // 3 upsert calls pour 3 slots
      expect(mockPrisma.wakaSpecSubChapterContent.upsert).toHaveBeenCalledTimes(3);
    });

    it('should include subChapters in the live result during the job', async () => {
      const spec = makeSpecWithSubChapters();

      mockPrisma.wakaSpecAiJob.findUnique
        .mockResolvedValueOnce(makeDbJob())
        .mockResolvedValueOnce({ status: 'RUNNING' });
      mockPrisma.wakaSpecification.findUnique.mockResolvedValue(spec);

      const subChapterJson = JSON.stringify([
        { index: 1, content: 'Sub content 1.1' },
        { index: 2, content: 'Sub content L2 A' },
        { index: 3, content: 'Sub content L2 B' },
      ]);
      mockMessagesCreate
        .mockResolvedValueOnce(makeClaudeResponse('Chapter 1 content'))
        .mockResolvedValueOnce(makeClaudeResponse(subChapterJson));

      const upsertedSc = {
        id: 1,
        wid: 'sc-wid-1',
        subChapterL1Wid: 'sc-l1-1',
        subChapterL2Wid: '',
        title: 'Sub 1.1',
        content: 'Sub content 1.1',
        progress: 10,
        order: 0,
      };
      mockPrisma.wakaSpecSubChapterContent.upsert.mockResolvedValue(upsertedSc);
      mockPrisma.wakaSpecChapterContent.findMany.mockResolvedValue([{ progress: 30, isFilled: true }]);

      await processor.process({ name: 'ventilate', data: { jobWid: 'job-1' } } as any);

      // Le result final doit avoir des subChapters
      const calls = mockPrisma.wakaSpecAiJob.update.mock.calls;
      const succeededCall = calls.find(
        (c: unknown[]) => (c[0] as any).data?.status === 'SUCCEEDED',
      );
      expect(succeededCall).toBeDefined();
      const result = (succeededCall![0] as any).data.result;
      expect(result.subChapters).toBeDefined();
      expect(result.subChapters.length).toBeGreaterThan(0);
    });

    it('should include progress object in result with filled/total/percent', async () => {
      const spec = makeSpecification([{ wid: 'ch-1', title: 'Ch1', order: 0 }]);

      mockPrisma.wakaSpecAiJob.findUnique
        .mockResolvedValueOnce(makeDbJob())
        .mockResolvedValueOnce({ status: 'RUNNING' });
      mockPrisma.wakaSpecification.findUnique.mockResolvedValue(spec);
      mockPrisma.wakaSpecChapterContent.findMany.mockResolvedValue([{ progress: 60, isFilled: true }]);

      // Long enough text to be isFilled
      mockMessagesCreate.mockResolvedValue(
        makeClaudeResponse('This is a long enough chapter content that should be marked as filled because it exceeds 30 chars'),
      );

      await processor.process({ name: 'ventilate', data: { jobWid: 'job-1' } } as any);

      const calls = mockPrisma.wakaSpecAiJob.update.mock.calls;
      const succeededCall = calls.find(
        (c: unknown[]) => (c[0] as any).data?.status === 'SUCCEEDED',
      );
      expect(succeededCall).toBeDefined();
      const result = (succeededCall![0] as any).data.result;
      expect(result.progress).toEqual(
        expect.objectContaining({
          filled: expect.any(Number),
          total: 1,
          percent: expect.any(Number),
        }),
      );
    });
  });

  // ── CANCELLED ──────────────────────────────────────────────────

  describe('cancellation handling', () => {
    it('should abort early if job is already CANCELLED before processing', async () => {
      mockPrisma.wakaSpecAiJob.findUnique.mockResolvedValueOnce(
        makeDbJob({ status: 'CANCELLED' }),
      );

      await processor.process({ name: 'ventilate', data: { jobWid: 'job-1' } } as any);

      expect(mockMessagesCreate).not.toHaveBeenCalled();
    });

    it('should mark job CANCELLED when cancellation detected mid-loop', async () => {
      const spec = makeSpecification([
        { wid: 'ch-1', title: 'Ch1', order: 0 },
        { wid: 'ch-2', title: 'Ch2', order: 1 },
      ]);

      mockPrisma.wakaSpecAiJob.findUnique
        .mockResolvedValueOnce(makeDbJob()) // initial load
        .mockResolvedValueOnce({ status: 'RUNNING' }) // first check
        .mockResolvedValueOnce({ status: 'CANCELLED' }); // second check — triggers cancel

      mockPrisma.wakaSpecification.findUnique.mockResolvedValue(spec);
      mockPrisma.wakaSpecChapterContent.findMany.mockResolvedValue([]);

      await processor.process({ name: 'ventilate', data: { jobWid: 'job-1' } } as any);

      const calls = mockPrisma.wakaSpecAiJob.update.mock.calls;
      const cancelledCall = calls.find(
        (c: unknown[]) => (c[0] as any).data?.status === 'CANCELLED',
      );
      expect(cancelledCall).toBeDefined();
    });

    it('should return without throwing when job not found in DB', async () => {
      mockPrisma.wakaSpecAiJob.findUnique.mockResolvedValueOnce(null);

      await expect(
        processor.process({ name: 'ventilate', data: { jobWid: 'job-not-found' } } as any),
      ).resolves.toBeUndefined();
    });
  });

  // ── FAILED ─────────────────────────────────────────────────────

  describe('error handling', () => {
    it('should mark job FAILED with errorCode when Claude throws', async () => {
      const spec = makeSpecification([{ wid: 'ch-1', title: 'Ch1', order: 0 }]);

      mockPrisma.wakaSpecAiJob.findUnique
        .mockResolvedValueOnce(makeDbJob())
        .mockResolvedValueOnce({ status: 'RUNNING' });
      mockPrisma.wakaSpecification.findUnique.mockResolvedValue(spec);

      const claudeError = Object.assign(new Error('Rate limited'), { status: 429 });
      mockMessagesCreate.mockRejectedValueOnce(claudeError);

      await expect(
        processor.process({ name: 'ventilate', data: { jobWid: 'job-1' } } as any),
      ).rejects.toThrow();

      const calls = mockPrisma.wakaSpecAiJob.update.mock.calls;
      const failedCall = calls.find(
        (c: unknown[]) => (c[0] as any).data?.status === 'FAILED',
      );
      expect(failedCall).toBeDefined();
      expect((failedCall![0] as any).data.errorCode).toBe('ANTHROPIC_RATE_LIMIT');
    });

    it('should mark FAILED with INTERNAL errorCode for unknown errors', async () => {
      const spec = makeSpecification([{ wid: 'ch-1', title: 'Ch1', order: 0 }]);

      mockPrisma.wakaSpecAiJob.findUnique
        .mockResolvedValueOnce(makeDbJob())
        .mockResolvedValueOnce({ status: 'RUNNING' });
      mockPrisma.wakaSpecification.findUnique.mockResolvedValue(spec);
      mockMessagesCreate.mockRejectedValueOnce(new Error('Something unexpected'));

      await expect(
        processor.process({ name: 'ventilate', data: { jobWid: 'job-1' } } as any),
      ).rejects.toThrow();

      const calls = mockPrisma.wakaSpecAiJob.update.mock.calls;
      const failedCall = calls.find(
        (c: unknown[]) => (c[0] as any).data?.status === 'FAILED',
      );
      expect(failedCall).toBeDefined();
      expect((failedCall![0] as any).data.errorCode).toBe('INTERNAL');
    });
  });

  // ── processVentilateSubChapters (job dédié) ────────────────────

  describe('processVentilateSubChapters (standalone job)', () => {
    function makeSubJobDbJob() {
      return {
        ...makeDbJob(),
        type: 'VENTILATE_SUBCHAPTERS',
        input: {
          specificationWid: 'spec-wid-1',
          chapterWid: 'ch-1',
          chapterContentId: 100,
          userId: 'user-1',
        },
      };
    }

    it('should mark SUCCEEDED and write sub-chapter content', async () => {
      const spec = makeSpecification([
        {
          wid: 'ch-1',
          title: 'Chapter 1',
          order: 0,
          subChaptersL1: [
            { wid: 'sc-l1-1', title: 'Sub 1.1', order: 0, subChaptersL2: [] },
          ],
        },
      ]);

      mockPrisma.wakaSpecAiJob.findUnique
        .mockResolvedValueOnce(makeSubJobDbJob())
        .mockResolvedValueOnce({ status: 'RUNNING' });
      mockPrisma.wakaSpecification.findUnique.mockResolvedValue(spec);
      mockPrisma.wakaSpecChapterContent.findUnique.mockResolvedValue({
        id: 100,
        chapterWid: 'ch-1',
        chapterTitle: 'Chapter 1',
        content: 'Chapter 1 parent content long enough',
        progress: 50,
      });

      const subChapterJson = JSON.stringify([
        { index: 1, content: 'Sub-chapter content for 1.1 that is long enough to be useful' },
      ]);
      mockMessagesCreate.mockResolvedValueOnce(makeClaudeResponse(subChapterJson));

      mockPrisma.wakaSpecSubChapterContent.upsert.mockResolvedValue({
        id: 1,
        wid: 'sc-wid-1',
        subChapterL1Wid: 'sc-l1-1',
        subChapterL2Wid: '',
        title: 'Sub 1.1',
        content: 'Sub-chapter content',
        progress: 40,
        order: 0,
      });

      mockPrisma.wakaSpecChapterContent.findMany.mockResolvedValue([{ progress: 50, isFilled: true }]);

      await processor.process({ name: 'ventilate-subchapters', data: { jobWid: 'job-1' } } as any);

      const calls = mockPrisma.wakaSpecAiJob.update.mock.calls;
      const succeededCall = calls.find(
        (c: unknown[]) => (c[0] as any).data?.status === 'SUCCEEDED',
      );
      expect(succeededCall).toBeDefined();
      const result = (succeededCall![0] as any).data.result;
      expect(result.subChapters).toHaveLength(1);
      expect(result.subChapters[0]).toEqual(
        expect.objectContaining({
          wid: 'sc-wid-1',
          subChapterL1Wid: 'sc-l1-1',
        }),
      );
    });

    it('should abort if already CANCELLED', async () => {
      mockPrisma.wakaSpecAiJob.findUnique.mockResolvedValueOnce(
        makeSubJobDbJob().status = 'CANCELLED' as any || makeSubJobDbJob(),
      );
      // Actually use a proper cancelled job
      const cancelledJob = { ...makeSubJobDbJob(), status: 'CANCELLED' };
      mockPrisma.wakaSpecAiJob.findUnique.mockReset();
      mockPrisma.wakaSpecAiJob.findUnique.mockResolvedValueOnce(cancelledJob);

      await processor.process({ name: 'ventilate-subchapters', data: { jobWid: 'job-1' } } as any);

      expect(mockMessagesCreate).not.toHaveBeenCalled();
    });

    it('should fail with error when chapterContent not found', async () => {
      const spec = makeSpecification([
        { wid: 'ch-1', title: 'Ch1', order: 0, subChaptersL1: [
          { wid: 'sc-l1-1', title: 'Sub 1.1', order: 0, subChaptersL2: [] },
        ]},
      ]);

      mockPrisma.wakaSpecAiJob.findUnique.mockResolvedValueOnce(makeSubJobDbJob());
      mockPrisma.wakaSpecification.findUnique.mockResolvedValue(spec);
      mockPrisma.wakaSpecChapterContent.findUnique.mockResolvedValue(null); // not found

      await expect(
        processor.process({ name: 'ventilate-subchapters', data: { jobWid: 'job-1' } } as any),
      ).rejects.toThrow();

      const calls = mockPrisma.wakaSpecAiJob.update.mock.calls;
      const failedCall = calls.find(
        (c: unknown[]) => (c[0] as any).data?.status === 'FAILED',
      );
      expect(failedCall).toBeDefined();
    });
  });

  // ── JobCancelledError ──────────────────────────────────────────

  describe('JobCancelledError', () => {
    it('should be an instance of Error with proper name', () => {
      const err = new JobCancelledError('test-wid');
      expect(err).toBeInstanceOf(Error);
      expect(err.name).toBe('JobCancelledError');
      expect(err.message).toContain('test-wid');
    });
  });
});
