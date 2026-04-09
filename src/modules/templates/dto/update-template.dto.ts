import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, IsOptional } from 'class-validator';

export class UpdateTemplateDto {
  @ApiProperty({ description: 'Titre du modele', maxLength: 100, required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  title?: string;

  @ApiProperty({ description: 'Description affichee aux utilisateurs', required: false })
  @IsOptional()
  @IsString()
  userDescription?: string;

  @ApiProperty({ description: 'Description integree dans le document final', required: false })
  @IsOptional()
  @IsString()
  docDescription?: string;

  @ApiProperty({ description: 'Mega-prompt global associe au modele', required: false })
  @IsOptional()
  @IsString()
  megaPrompt?: string;
}
