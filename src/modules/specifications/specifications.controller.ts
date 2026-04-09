import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  Header,
} from '@nestjs/common';
import { ApiTags, ApiSecurity, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ApiKeyGuard } from '../../common/guards/api-key.guard.js';
import { SpecificationsService } from './specifications.service.js';
import { CreateSpecificationDto } from './dto/create-specification.dto.js';
import { UpdateSpecificationDto } from './dto/update-specification.dto.js';
import { UpdateChapterContentDto } from './dto/update-chapter-content.dto.js';
import { QuerySpecificationsDto } from './dto/query-specifications.dto.js';
import { CreateDynamicSubChapterDto } from './dto/create-dynamic-subchapter.dto.js';

@Controller('specifications')
@ApiTags('specifications')
@UseGuards(ApiKeyGuard)
@ApiSecurity('api-key')
export class SpecificationsController {
  constructor(private readonly specificationsService: SpecificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Lister les specifications' })
  @ApiResponse({ status: 200, description: 'Liste des specifications' })
  findAll(@Query() query: QuerySpecificationsDto) {
    return this.specificationsService.findAll(query);
  }

  @Get(':wid')
  @ApiOperation({ summary: 'Recuperer une specification par wid' })
  @ApiResponse({ status: 200, description: 'Specification trouvee' })
  @ApiResponse({ status: 404, description: 'Specification non trouvee' })
  findOne(@Param('wid') wid: string) {
    return this.specificationsService.findOne(wid);
  }

  @Post()
  @ApiOperation({ summary: 'Creer une specification depuis un template' })
  @ApiResponse({ status: 201, description: 'Specification creee' })
  @ApiResponse({ status: 404, description: 'Template non trouve' })
  create(@Body() dto: CreateSpecificationDto) {
    return this.specificationsService.create(dto);
  }

  @Patch(':wid')
  @ApiOperation({ summary: 'Mettre a jour une specification' })
  @ApiResponse({ status: 200, description: 'Specification mise a jour' })
  @ApiResponse({ status: 404, description: 'Specification non trouvee' })
  update(@Param('wid') wid: string, @Body() dto: UpdateSpecificationDto) {
    return this.specificationsService.update(wid, dto);
  }

  @Delete(':wid')
  @ApiOperation({ summary: 'Supprimer une specification' })
  @ApiResponse({ status: 200, description: 'Specification supprimee' })
  @ApiResponse({ status: 404, description: 'Specification non trouvee' })
  remove(@Param('wid') wid: string) {
    return this.specificationsService.softDelete(wid);
  }

  @Get(':wid/chapters/:chapterWid')
  @ApiOperation({ summary: 'Recuperer le contenu d un chapitre' })
  @ApiResponse({ status: 200, description: 'Contenu du chapitre' })
  @ApiResponse({ status: 404, description: 'Chapitre non trouve' })
  getChapterContent(
    @Param('wid') wid: string,
    @Param('chapterWid') chapterWid: string,
  ) {
    return this.specificationsService.getChapterContent(wid, chapterWid);
  }

  @Patch(':wid/chapters/:chapterWid')
  @ApiOperation({ summary: 'Mettre a jour le contenu d un chapitre' })
  @ApiResponse({ status: 200, description: 'Chapitre mis a jour' })
  @ApiResponse({ status: 404, description: 'Chapitre non trouve' })
  updateChapterContent(
    @Param('wid') wid: string,
    @Param('chapterWid') chapterWid: string,
    @Body() dto: UpdateChapterContentDto,
  ) {
    return this.specificationsService.updateChapterContent(
      wid,
      chapterWid,
      dto,
    );
  }

  @Post(':wid/chapters/subchapters')
  @ApiOperation({ summary: 'Ajouter un sous-chapitre dynamique' })
  @ApiResponse({ status: 201, description: 'Sous-chapitre cree' })
  @ApiResponse({ status: 404, description: 'Specification non trouvee' })
  addDynamicSubChapter(
    @Param('wid') wid: string,
    @Body() dto: CreateDynamicSubChapterDto,
  ) {
    return this.specificationsService.addDynamicSubChapter(wid, dto);
  }

  @Delete(':wid/chapters/:chapterWid/subchapters/:scWid')
  @ApiOperation({ summary: 'Supprimer un sous-chapitre dynamique' })
  @ApiResponse({ status: 200, description: 'Sous-chapitre supprime' })
  @ApiResponse({ status: 404, description: 'Sous-chapitre non trouve' })
  removeDynamicSubChapter(
    @Param('wid') wid: string,
    @Param('scWid') scWid: string,
  ) {
    return this.specificationsService.removeDynamicSubChapter(wid, scWid);
  }

  @Get(':wid/export')
  @ApiOperation({ summary: 'Exporter la specification en markdown' })
  @ApiResponse({ status: 200, description: 'Document markdown' })
  @ApiResponse({ status: 404, description: 'Specification non trouvee' })
  @Header('Content-Type', 'text/markdown')
  exportMarkdown(@Param('wid') wid: string) {
    return this.specificationsService.exportMarkdown(wid);
  }

  @Post(':wid/save-version')
  @ApiOperation({ summary: 'Sauvegarder une version de la specification' })
  @ApiResponse({
    status: 201,
    description: 'Version sauvegardee avec markdown et numero',
  })
  @ApiResponse({ status: 404, description: 'Specification non trouvee' })
  saveVersion(@Param('wid') wid: string) {
    return this.specificationsService.saveVersion(wid);
  }
}
