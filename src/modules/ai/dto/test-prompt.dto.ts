import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class TestPromptDto {
  @ApiProperty({ description: 'Le mega-prompt (system prompt) du template' })
  @IsString()
  @IsNotEmpty()
  megaPrompt: string;

  @ApiProperty({ description: 'Le prompt du chapitre a tester' })
  @IsString()
  @IsNotEmpty()
  chapterPrompt: string;

  @ApiPropertyOptional({
    description: 'Texte d entree exemple pour simuler du contenu utilisateur',
  })
  @IsString()
  @IsOptional()
  sampleInput?: string;
}
