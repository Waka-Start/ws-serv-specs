import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class CreateDynamicSubChapterDto {
  @ApiProperty({ description: 'Titre du sous-chapitre dynamique' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    description: 'WID du chapitre parent auquel rattacher le sous-chapitre',
  })
  @IsString()
  @IsNotEmpty()
  chapterWid: string;
}
