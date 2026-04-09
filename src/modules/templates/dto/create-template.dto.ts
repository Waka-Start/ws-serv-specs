import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, IsNotEmpty } from 'class-validator';

export class CreateTemplateDto {
  @ApiProperty({ description: 'Titre du modele', maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  title: string;

  @ApiProperty({ description: 'Description affichee aux utilisateurs' })
  @IsString()
  @IsNotEmpty()
  userDescription: string;

  @ApiProperty({ description: 'Description integree dans le document final' })
  @IsString()
  @IsNotEmpty()
  docDescription: string;

  @ApiProperty({ description: 'Mega-prompt global associe au modele' })
  @IsString()
  @IsNotEmpty()
  megaPrompt: string;

  @ApiProperty({ description: 'Identifiant du createur' })
  @IsString()
  @IsNotEmpty()
  createdBy: string;
}
