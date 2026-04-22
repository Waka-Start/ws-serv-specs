import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsArray, IsOptional } from 'class-validator';

export class SuggestQuestionsDto {
  @ApiProperty({ description: 'Titre du chapitre a rediger' })
  @IsString()
  @IsNotEmpty()
  chapterTitle: string;

  @ApiProperty({ description: 'Description ou prompt du chapitre (ce qu il doit couvrir)' })
  @IsString()
  @IsNotEmpty()
  chapterPrompt: string;

  @ApiPropertyOptional({
    description: 'Titres des sous-chapitres prevus pour ce chapitre',
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  subChapterTitles?: string[];

  @ApiPropertyOptional({
    description: 'Contenu deja redige dans le chapitre (pour eviter les questions redondantes)',
  })
  @IsString()
  @IsOptional()
  existingContent?: string;

  @ApiPropertyOptional({
    description: 'Texte initial saisi par l utilisateur (contexte global du projet)',
  })
  @IsString()
  @IsOptional()
  initialText?: string;
}

export interface SuggestedQuestion {
  question: string;
  category: 'fonctionnel' | 'technique' | 'utilisateur' | 'contrainte';
}
