import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsBoolean, IsOptional } from 'class-validator';

export class UpdateSubChapterL1Dto {
  @ApiProperty({ description: 'Titre du sous-chapitre L1', required: false })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({ description: 'Indique si le sous-chapitre est variable', required: false })
  @IsOptional()
  @IsBoolean()
  isVariable?: boolean;
}
