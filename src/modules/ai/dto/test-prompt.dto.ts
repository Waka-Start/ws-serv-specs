import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsString, IsNotEmpty, IsOptional, MaxLength } from "class-validator";

export class TestPromptDto {
  @ApiProperty({
    description: "Le mega-prompt (system prompt) du template",
    maxLength: 50000,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50000)
  megaPrompt: string;

  @ApiProperty({
    description: "Le prompt du chapitre a tester",
    maxLength: 50000,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50000)
  chapterPrompt: string;

  @ApiPropertyOptional({
    description: "Texte d entree exemple pour simuler du contenu utilisateur",
    maxLength: 10000,
  })
  @IsString()
  @IsOptional()
  @MaxLength(10000)
  sampleInput?: string;
}
