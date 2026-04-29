import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { ApiKeyGuard } from '../../common/guards/api-key.guard.js';
import { AiJobsService } from './ai-jobs.service.js';
import { AiJobResponseDto, ListAiJobsQueryDto } from './dto/ai-job.dto.js';
import { WakaSpecAiJob } from '@prisma/client';

function toResponseDto(job: WakaSpecAiJob): AiJobResponseDto {
  return {
    jobWid: job.wid,
    type: job.type,
    status: job.status,
    progress: job.progress as Record<string, unknown> | null,
    result: job.result as Record<string, unknown> | null,
    errorMessage: job.errorMessage,
    errorCode: job.errorCode,
  };
}

@Controller('ai/jobs')
@ApiTags('ai-jobs')
@UseGuards(ApiKeyGuard)
@ApiSecurity('api-key')
export class AiJobsController {
  constructor(private readonly aiJobsService: AiJobsService) {}

  @Get()
  @ApiOperation({ summary: 'Lister les jobs IA filtrés par specification et statut' })
  @ApiQuery({ name: 'specificationWid', required: true, description: 'WID de la specification' })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filtrer par statuts (comma-separated ex: PENDING,RUNNING)',
  })
  @ApiResponse({ status: 200, type: [AiJobResponseDto] })
  async listJobs(@Query() query: ListAiJobsQueryDto): Promise<AiJobResponseDto[]> {
    const jobs = await this.aiJobsService.listJobs(
      query.specificationWid,
      query.status,
    );
    return jobs.map(toResponseDto);
  }

  @Get(':jobWid')
  @ApiOperation({ summary: "Récupérer l'état courant d'un job IA" })
  @ApiParam({ name: 'jobWid', description: 'WID du job' })
  @ApiResponse({ status: 200, type: AiJobResponseDto })
  @ApiResponse({ status: 404, description: 'Job non trouvé' })
  async getJob(@Param('jobWid') jobWid: string): Promise<AiJobResponseDto> {
    const job = await this.aiJobsService.getJob(jobWid);
    return toResponseDto(job);
  }

  @Post(':jobWid/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Annuler un job IA (si PENDING ou RUNNING)' })
  @ApiParam({ name: 'jobWid', description: 'WID du job' })
  @ApiResponse({ status: 200, type: AiJobResponseDto })
  @ApiResponse({ status: 404, description: 'Job non trouvé' })
  @ApiResponse({ status: 409, description: 'Job déjà terminé — ne peut pas être annulé' })
  async cancelJob(@Param('jobWid') jobWid: string): Promise<AiJobResponseDto> {
    const job = await this.aiJobsService.cancelJob(jobWid);
    return toResponseDto(job);
  }
}
