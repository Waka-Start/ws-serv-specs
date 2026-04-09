import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class ModifyContentDto {
  @ApiProperty({ description: 'WID de la specification' })
  @IsString()
  @IsNotEmpty()
  specificationWid: string;

  @ApiProperty({ description: 'WID du chapitre contenant le texte' })
  @IsString()
  @IsNotEmpty()
  chapterWid: string;

  @ApiProperty({ description: 'Texte selectionne par l utilisateur a modifier' })
  @IsString()
  @IsNotEmpty()
  selectedText: string;

  @ApiProperty({ description: 'Instruction de modification' })
  @IsString()
  @IsNotEmpty()
  userInstruction: string;

  @ApiProperty({ description: 'Identifiant de l utilisateur' })
  @IsString()
  @IsNotEmpty()
  userId: string;
}
