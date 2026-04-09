import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class GenerateChapterDto {
  @ApiProperty({ description: 'WID de la specification' })
  @IsString()
  @IsNotEmpty()
  specificationWid: string;

  @ApiProperty({ description: 'WID du chapitre a generer' })
  @IsString()
  @IsNotEmpty()
  chapterWid: string;

  @ApiPropertyOptional({ description: 'Instruction utilisateur pour guider la generation' })
  @IsString()
  @IsOptional()
  userInstruction?: string;

  @ApiProperty({ description: 'Identifiant de l utilisateur' })
  @IsString()
  @IsNotEmpty()
  userId: string;
}
