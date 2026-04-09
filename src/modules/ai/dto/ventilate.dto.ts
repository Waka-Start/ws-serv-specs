import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class VentilateDto {
  @ApiProperty({ description: 'WID de la specification cible' })
  @IsString()
  @IsNotEmpty()
  specificationWid: string;

  @ApiProperty({ description: 'Texte initial a ventiler dans les chapitres' })
  @IsString()
  @IsNotEmpty()
  initialText: string;

  @ApiProperty({ description: 'Identifiant de l utilisateur' })
  @IsString()
  @IsNotEmpty()
  userId: string;
}
