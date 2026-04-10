import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, MaxLength, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateTemplateDto {
  @ApiProperty({ description: 'Titre du modele', maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  title: string;

  @ApiPropertyOptional({ description: 'Description affichee aux utilisateurs' })
  @IsOptional()
  @IsString()
  userDescription?: string;

  @ApiPropertyOptional({ description: 'Description integree dans le document final' })
  @IsOptional()
  @IsString()
  docDescription?: string;

  @ApiPropertyOptional({ description: 'Mega-prompt global associe au modele' })
  @IsOptional()
  @IsString()
  megaPrompt?: string;

  @ApiPropertyOptional({ description: 'Identifiant du createur' })
  @IsOptional()
  @IsString()
  createdBy?: string;
}
