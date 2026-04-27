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

  @ApiPropertyOptional({ description: 'Progression du job (RUNNING uniquement)' })
  progress?: Record<string, unknown> | null;

  @ApiPropertyOptional({ description: 'Résultat du job (SUCCEEDED uniquement)' })
  result?: Record<string, unknown> | null;

  @ApiPropertyOptional({ description: "Message d'erreur (FAILED uniquement)" })
  errorMessage?: string | null;

  @ApiPropertyOptional({ description: 'Code erreur classifié (FAILED uniquement)' })
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
