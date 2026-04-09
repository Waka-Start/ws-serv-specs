import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ApiKeyGuard } from '../../common/guards/api-key.guard.js';
import { AiService } from './ai.service.js';
import { VentilateDto } from './dto/ventilate.dto.js';
import { GenerateChapterDto } from './dto/generate-chapter.dto.js';
import { ModifyContentDto } from './dto/modify-content.dto.js';
import { DeleteContentDto } from './dto/delete-content.dto.js';

@Controller('ai')
@ApiTags('ai')
@UseGuards(ApiKeyGuard)
@ApiSecurity('api-key')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('ventilate')
  @ApiOperation({
    summary: 'Ventiler un texte initial dans tous les chapitres',
  })
  ventilate(@Body() dto: VentilateDto) {
    return this.aiService.ventilate(dto);
  }

  @Post('generate')
  @ApiOperation({
    summary: 'Generer ou enrichir le contenu d un chapitre avec l IA',
  })
  generateChapter(@Body() dto: GenerateChapterDto) {
    return this.aiService.generateChapter(dto);
  }

  @Post('modify')
  @ApiOperation({
    summary: 'Modifier un texte selectionne dans un chapitre',
  })
  modifyContent(@Body() dto: ModifyContentDto) {
    return this.aiService.modifyContent(dto);
  }

  @Post('delete-content')
  @ApiOperation({
    summary: 'Supprimer un texte selectionne d un chapitre',
  })
  deleteContent(@Body() dto: DeleteContentDto) {
    return this.aiService.deleteContent(dto);
  }

  @Get('history/:specificationWid')
  @ApiOperation({
    summary: 'Recuperer l historique des interactions IA d une specification',
  })
  getHistory(@Param('specificationWid') specificationWid: string) {
    return this.aiService.getHistory(specificationWid);
  }
}
