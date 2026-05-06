import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { EnumAiJobStatus, EnumAiJobType } from '@prisma/client';

export class AiJobResponseDto {
  @ApiProperty({ description: 'Identifiant unique du job' })
  declare jobWid: string;

  @ApiProperty({ enum: EnumAiJobType, description: 'Type de job IA' })
  declare type: EnumAiJobType;

  @ApiProperty({ enum: EnumAiJobStatus, description: 'Statut courant du job' })
  declare status: EnumAiJobStatus;

  @ApiPropertyOptional({
    description: 'Progression du job (RUNNING uniquement). Pour VENTILATE_SUBCHAPTERS : { currentStep, totalSteps, phase, currentSubChapterTitle }',
  })
  progress?: Record<string, unknown> | null;

  @ApiPropertyOptional({
    description: [
      'Resultat du job (SUCCEEDED uniquement).',
      'Pour VENTILATE : { chapters: [{ chapterWid, content }] }.',
      'Pour VENTILATE_SUBCHAPTERS : { subChapters: [{ wid, subChapterL1Wid, subChapterL2Wid, title, content, progress, order }] }.',
      'Ce champ est mis a jour au fil de l eau (polling-friendly).',
    ].join(' '),
  })
  result?: Record<string, unknown> | null;

  @ApiPropertyOptional({ description: "Message d'erreur (FAILED uniquement)" })
  errorMessage?: string | null;

  @ApiPropertyOptional({ description: 'Code erreur classifie (FAILED uniquement)' })
  errorCode?: string | null;
}

export class ListAiJobsQueryDto {
  @ApiProperty({ description: 'WID de la specification' })
  @IsString()
  declare specificationWid: string;

  @ApiPropertyOptional({
    description: 'Filtrer par statuts (comma-separated)',
    example: 'PENDING,RUNNING',
  })
  @IsOptional()
  @IsString()
  status?: string;
}
