import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsInt, Min, Max, IsBoolean, IsOptional } from 'class-validator';

export class UpdateChapterContentDto {
  @ApiProperty({ description: 'Contenu markdown du chapitre' })
  @IsString()
  content: string;

  @ApiPropertyOptional({
    description: 'Pourcentage de completion du chapitre (0-100)',
    minimum: 0,
    maximum: 100,
  })
  @IsInt()
  @Min(0)
  @Max(100)
  @IsOptional()
  progress?: number;

  @ApiPropertyOptional({
    description: 'Indique si c est une sauvegarde automatique',
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  isAutoSaved?: boolean;
}
