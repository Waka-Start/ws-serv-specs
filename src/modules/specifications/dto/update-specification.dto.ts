import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum } from 'class-validator';
import { SpecificationStatus } from '@prisma/client';

export class UpdateSpecificationDto {
  @ApiPropertyOptional({ description: 'Nouveau nom de la specification' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({
    description: 'Nouveau statut',
    enum: SpecificationStatus,
  })
  @IsEnum(SpecificationStatus)
  @IsOptional()
  status?: SpecificationStatus;

  @ApiPropertyOptional({ description: 'Identifiant du modificateur' })
  @IsString()
  @IsOptional()
  updatedBy?: string;
}
