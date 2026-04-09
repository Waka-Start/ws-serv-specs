import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsBoolean, IsOptional } from 'class-validator';

export class CreateSubChapterL1Dto {
  @ApiProperty({ description: 'Titre du sous-chapitre L1' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ description: 'Indique si le sous-chapitre est variable', default: false, required: false })
  @IsOptional()
  @IsBoolean()
  isVariable?: boolean;
}
