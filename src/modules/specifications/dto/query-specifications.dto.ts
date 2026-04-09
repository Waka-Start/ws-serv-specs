import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class QuerySpecificationsDto {
  @ApiPropertyOptional({ description: 'Filtrer par identifiant de projet' })
  @IsString()
  @IsOptional()
  projectId?: string;

  @ApiPropertyOptional({ description: 'Filtrer par identifiant d etape' })
  @IsString()
  @IsOptional()
  stepId?: string;
}
