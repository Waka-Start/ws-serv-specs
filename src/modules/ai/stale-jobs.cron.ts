import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { AiJobsService } from './ai-jobs.service.js';

// Cron de nettoyage des jobs orphelins (stale)
// Implémenté comme un BullMQ repeatable job (toutes les 5 minutes)
// Alternative à @nestjs/schedule pour éviter une dépendance supplémentaire

@Injectable()
export class StaleJobsCron implements OnModuleInit {
  private readonly logger = new Logger(StaleJobsCron.name);
  private static readonly CRON_JOB_NAME = 'cleanup-stale-jobs';
  private static readonly REPEAT_EVERY_MS = 5 * 60 * 1000; // 5 minutes

  constructor(
    @InjectQueue('ai-jobs') private readonly aiJobsQueue: Queue,
    private readonly aiJobsService: AiJobsService,
  ) {}

  async onModuleInit(): Promise<void> {
    // Enregistrer le repeatable job au démarrage du module
    await this.aiJobsQueue.add(
      StaleJobsCron.CRON_JOB_NAME,
      {},
      {
        repeat: { every: StaleJobsCron.REPEAT_EVERY_MS },
        jobId: `repeatable:${StaleJobsCron.CRON_JOB_NAME}`,
        removeOnComplete: true,
        removeOnFail: true,
      },
    );

    this.logger.log(
      `StaleJobsCron registered — will run every ${StaleJobsCron.REPEAT_EVERY_MS / 1000}s`,
    );
  }

  // Appelé par AiJobsProcessor quand il reçoit un job de nom 'cleanup-stale-jobs'
  async run(): Promise<void> {
    this.logger.debug('Running stale jobs cleanup...');
    await this.aiJobsService.cleanStaleJobs();
  }
}
