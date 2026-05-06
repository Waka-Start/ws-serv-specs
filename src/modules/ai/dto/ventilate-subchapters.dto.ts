import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class VentilateSubChaptersDto {
  @ApiProperty({ description: 'WID de la specification' })
  @IsString()
  @IsNotEmpty()
  specificationWid: string;

  @ApiProperty({ description: 'Identifiant de l utilisateur' })
  @IsString()
  @IsNotEmpty()
  userId: string;
}

export class VentilateSubChaptersResponseDto {
  @ApiProperty({ description: 'WID du job BullMQ cree' })
  declare jobId: string;
}
