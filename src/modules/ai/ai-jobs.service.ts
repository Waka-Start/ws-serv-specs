import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { EnumAiJobStatus, EnumAiJobType, WakaSpecAiJob } from '@prisma/client';

@Injectable()
export class AiJobsService {
  private readonly logger = new Logger(AiJobsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getJob(jobWid: string): Promise<WakaSpecAiJob> {
    const job = await this.prisma.wakaSpecAiJob.findUnique({
      where: { wid: jobWid },
    });

    if (!job) {
      throw new NotFoundException(`Job ${jobWid} not found`);
    }

    return job;
  }

  async cancelJob(jobWid: string): Promise<WakaSpecAiJob> {
    const job = await this.prisma.wakaSpecAiJob.findUnique({
      where: { wid: jobWid },
    });

    if (!job) {
      throw new NotFoundException(`Job ${jobWid} not found`);
    }

    if (
      job.status !== EnumAiJobStatus.PENDING &&
      job.status !== EnumAiJobStatus.RUNNING
    ) {
      throw new ConflictException(
        `Cannot cancel job ${jobWid} with status ${job.status} (must be PENDING or RUNNING)`,
      );
    }

    const updated = await this.prisma.wakaSpecAiJob.update({
      where: { wid: jobWid },
      data: {
        status: EnumAiJobStatus.CANCELLED,
        finishedAt: new Date(),
      },
    });

    this.logger.log(`Job ${jobWid}: cancelled (was ${job.status})`);
    return updated;
  }

  async listJobs(
    specificationWid: string,
    statusFilter?: string,
  ): Promise<WakaSpecAiJob[]> {
    const statuses = statusFilter
      ? (statusFilter.split(',').map((s) => s.trim()) as EnumAiJobStatus[])
      : undefined;

    return this.prisma.wakaSpecAiJob.findMany({
      where: {
        specificationWid,
        ...(statuses ? { status: { in: statuses } } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Cron de nettoyage : marque FAILED les jobs RUNNING depuis plus de 10 min
  async cleanStaleJobs(): Promise<void> {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

    const staleJobs = await this.prisma.wakaSpecAiJob.findMany({
      where: {
        status: EnumAiJobStatus.RUNNING,
        startedAt: { lt: tenMinutesAgo },
      },
    });

    if (staleJobs.length === 0) return;

    this.logger.warn(
      `cleanStaleJobs: found ${staleJobs.length} stale job(s) — marking FAILED`,
    );

    await this.prisma.wakaSpecAiJob.updateMany({
      where: {
        id: { in: staleJobs.map((j: { id: string }) => j.id) },
      },
      data: {
        status: EnumAiJobStatus.FAILED,
        errorCode: 'STALE_JOB',
        errorMessage: 'Job orphelin (pod redémarré ?)',
        finishedAt: new Date(),
      },
    });

    // Log individuel pour traçabilité
    for (const job of staleJobs) {
      const type: EnumAiJobType = job.type;
      this.logger.warn(
        `cleanStaleJobs: marked FAILED — jobWid=${job.wid} type=${type} startedAt=${job.startedAt?.toISOString()}`,
      );
    }
  }
}
