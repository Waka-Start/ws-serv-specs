import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class EvaluationDetailsDto {
  @ApiProperty({ description: 'Score de completude (0-100)' })
  declare score: number;

  @ApiProperty({ type: [String], description: 'Sujets couverts' })
  declare coveredTopics: string[];

  @ApiProperty({ type: [String], description: 'Sujets manquants' })
  declare missingTopics: string[];

  @ApiProperty({ description: 'Feedback synthetique' })
  declare feedback: string;
}

export class GenerateChapterChapterDto {
  @ApiProperty({ description: 'WID du WakaSpecChapterContent' })
  declare wid: string;

  @ApiProperty({ description: 'WID du chapitre template' })
  declare chapterWid: string;

  @ApiProperty({ description: 'Titre du chapitre' })
  declare chapterTitle: string;

  @ApiProperty({ description: 'Contenu genere' })
  declare content: string;

  @ApiProperty({ description: 'Score de completude (0-100)' })
  declare progress: number;

  @ApiProperty({ description: 'true si progress >= 30' })
  declare isFilled: boolean;

  @ApiPropertyOptional({ type: EvaluationDetailsDto, nullable: true })
  declare evaluationDetails: EvaluationDetailsDto | null;

  @ApiPropertyOptional({ nullable: true, description: 'Date ISO de la derniere evaluation' })
  declare evaluatedAt: string | null;
}

export class GenerateChapterProgressDto {
  @ApiProperty({ description: 'Nombre de chapitres avec isFilled=true' })
  declare filled: number;

  @ApiProperty({ description: 'Nombre total de chapitres' })
  declare total: number;

  @ApiProperty({ description: 'Progression globale en % (= WakaSpecification.globalProgress)' })
  declare percent: number;
}

export class GenerateChapterResponseDto {
  @ApiProperty({ type: GenerateChapterChapterDto })
  declare chapter: GenerateChapterChapterDto;

  @ApiProperty({ type: GenerateChapterProgressDto })
  declare progress: GenerateChapterProgressDto;
}
