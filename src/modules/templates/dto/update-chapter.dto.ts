import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, IsBoolean, IsOptional } from 'class-validator';

export class UpdateChapterDto {
  @ApiProperty({ description: 'Titre du chapitre', maxLength: 40, required: false })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  title?: string;

  @ApiProperty({ description: 'Description affichee aux utilisateurs', required: false })
  @IsOptional()
  @IsString()
  userDescription?: string;

  @ApiProperty({ description: 'Description integree dans le document final', required: false })
  @IsOptional()
  @IsString()
  docDescription?: string;

  @ApiProperty({ description: 'Prompt associe au chapitre', required: false })
  @IsOptional()
  @IsString()
  prompt?: string;

  @ApiProperty({ description: 'Indique si le chapitre est variable', required: false })
  @IsOptional()
  @IsBoolean()
  isVariable?: boolean;
}
