import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, IsNotEmpty, IsBoolean, IsOptional } from 'class-validator';

export class CreateChapterDto {
  @ApiProperty({ description: 'Titre du chapitre', maxLength: 40 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  title: string;

  @ApiProperty({ description: 'Description affichee aux utilisateurs', required: false })
  @IsOptional()
  @IsString()
  userDescription?: string;

  @ApiProperty({ description: 'Description integree dans le document final', required: false })
  @IsOptional()
  @IsString()
  docDescription?: string;

  @ApiProperty({ description: 'Prompt associe au chapitre' })
  @IsString()
  @IsNotEmpty()
  prompt: string;

  @ApiProperty({ description: 'Indique si le chapitre est variable', default: false, required: false })
  @IsOptional()
  @IsBoolean()
  isVariable?: boolean;
}
