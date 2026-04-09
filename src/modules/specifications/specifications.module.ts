import { Module } from '@nestjs/common';
import { TemplatesModule } from '../templates/templates.module.js';
import { SpecificationsController } from './specifications.controller.js';
import { SpecificationsService } from './specifications.service.js';

@Module({
  imports: [TemplatesModule],
  controllers: [SpecificationsController],
  providers: [SpecificationsService],
  exports: [SpecificationsService],
})
export class SpecificationsModule {}
