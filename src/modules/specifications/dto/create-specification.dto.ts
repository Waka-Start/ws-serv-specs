import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateSpecificationDto {
  @ApiProperty({ description: 'WID du template a utiliser' })
  @IsString()
  @IsNotEmpty()
  templateWid: string;

  @ApiProperty({ description: 'Identifiant du projet WakaProject' })
  @IsString()
  @IsNotEmpty()
  projectId: string;

  @ApiPropertyOptional({ description: 'Identifiant de l etape du projet' })
  @IsString()
  @IsOptional()
  stepId?: string;

  @ApiProperty({ description: 'Nom de la specification' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    description: 'Texte initial pour la ventilation IA',
  })
  @IsString()
  @IsOptional()
  initialText?: string;

  @ApiProperty({ description: 'Identifiant du createur' })
  @IsString()
  @IsNotEmpty()
  createdBy: string;
}
