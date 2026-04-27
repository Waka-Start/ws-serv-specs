import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AiController } from './ai.controller.js';
import { AiService } from './ai.service.js';
import { AiJobsController } from './ai-jobs.controller.js';
import { AiJobsService } from './ai-jobs.service.js';
import { AiJobsProcessor } from './ai-jobs.processor.js';
import { StaleJobsCron } from './stale-jobs.cron.js';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'ai-jobs' }),
  ],
  controllers: [AiController, AiJobsController],
  providers: [AiService, AiJobsService, AiJobsProcessor, StaleJobsCron],
  exports: [BullModule],
})
export class AiModule {}
