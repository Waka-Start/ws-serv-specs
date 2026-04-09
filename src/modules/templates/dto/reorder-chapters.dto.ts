import { ApiProperty } from '@nestjs/swagger';
import { IsArray, ValidateNested, IsString, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

class ChapterOrderItem {
  @ApiProperty({ description: 'Identifiant unique du chapitre' })
  @IsString()
  wid: string;

  @ApiProperty({ description: 'Nouvel ordre du chapitre' })
  @IsInt()
  order: number;
}

export class ReorderChaptersDto {
  @ApiProperty({ type: [ChapterOrderItem], description: 'Liste des chapitres avec leur nouvel ordre' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChapterOrderItem)
  items: ChapterOrderItem[];
}
