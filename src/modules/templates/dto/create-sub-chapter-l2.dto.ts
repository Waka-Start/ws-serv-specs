import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateSubChapterL2Dto {
  @ApiProperty({ description: 'Titre du sous-chapitre L2', maxLength: 25 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(25)
  title: string;
}
