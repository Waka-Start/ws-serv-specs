import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength } from 'class-validator';

export class UpdateSubChapterL2Dto {
  @ApiProperty({ description: 'Titre du sous-chapitre L2', maxLength: 25, required: false })
  @IsOptional()
  @IsString()
  @MaxLength(25)
  title?: string;
}
