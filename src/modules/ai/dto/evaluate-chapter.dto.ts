import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class EvaluateChapterDto {
  @ApiProperty({ description: 'WID de la specification' })
  @IsString()
  specificationWid: string;

  @ApiProperty({ description: 'WID du chapitre a evaluer' })
  @IsString()
  chapterWid: string;
}

export class EvaluateAllChaptersDto {
  @ApiProperty({ description: 'WID de la specification' })
  @IsString()
  specificationWid: string;
}

export interface ChapterEvaluationDetails {
  score: number;
  coveredTopics: string[];
  missingTopics: string[];
  feedback: string;
  model: string;
}
