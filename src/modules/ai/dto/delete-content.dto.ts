import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class DeleteContentDto {
  @ApiProperty({ description: 'WID de la specification' })
  @IsString()
  @IsNotEmpty()
  specificationWid: string;

  @ApiProperty({ description: 'WID du chapitre contenant le texte' })
  @IsString()
  @IsNotEmpty()
  chapterWid: string;

  @ApiProperty({ description: 'Texte selectionne a supprimer' })
  @IsString()
  @IsNotEmpty()
  selectedText: string;

  @ApiProperty({ description: 'Identifiant de l utilisateur' })
  @IsString()
  @IsNotEmpty()
  userId: string;
}
