import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiSecurity } from '@nestjs/swagger';
import { ApiKeyGuard } from '../../common/guards/api-key.guard.js';
import { TemplatesService } from './templates.service.js';
import { CreateTemplateDto } from './dto/create-template.dto.js';
import { UpdateTemplateDto } from './dto/update-template.dto.js';
import { CreateChapterDto } from './dto/create-chapter.dto.js';
import { UpdateChapterDto } from './dto/update-chapter.dto.js';
import { ReorderChaptersDto } from './dto/reorder-chapters.dto.js';
import { CreateSubChapterL1Dto } from './dto/create-sub-chapter-l1.dto.js';
import { UpdateSubChapterL1Dto } from './dto/update-sub-chapter-l1.dto.js';
import { CreateSubChapterL2Dto } from './dto/create-sub-chapter-l2.dto.js';
import { UpdateSubChapterL2Dto } from './dto/update-sub-chapter-l2.dto.js';

@Controller('templates')
@ApiTags('templates')
@UseGuards(ApiKeyGuard)
@ApiSecurity('api-key')
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  // ── Templates ─────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'Lister tous les modeles actifs' })
  findAll() {
    return this.templatesService.findAll();
  }

  @Get(':wid')
  @ApiOperation({ summary: 'Recuperer un modele par wid avec sa hierarchie complete' })
  findOne(@Param('wid') wid: string) {
    return this.templatesService.findOne(wid);
  }

  @Post()
  @ApiOperation({ summary: 'Creer un nouveau modele' })
  create(@Body() dto: CreateTemplateDto) {
    return this.templatesService.create(dto);
  }

  @Patch(':wid')
  @ApiOperation({ summary: 'Mettre a jour un modele' })
  update(@Param('wid') wid: string, @Body() dto: UpdateTemplateDto) {
    return this.templatesService.update(wid, dto);
  }

  @Delete(':wid')
  @ApiOperation({ summary: 'Supprimer un modele (soft delete)' })
  remove(@Param('wid') wid: string) {
    return this.templatesService.softDelete(wid);
  }

  // ── Chapters ──────────────────────────────────────────────────

  @Post(':wid/chapters')
  @ApiOperation({ summary: 'Ajouter un chapitre a un modele' })
  addChapter(@Param('wid') wid: string, @Body() dto: CreateChapterDto) {
    return this.templatesService.addChapter(wid, dto);
  }

  @Patch(':wid/chapters/:chapterWid')
  @ApiOperation({ summary: 'Mettre a jour un chapitre' })
  updateChapter(
    @Param('wid') wid: string,
    @Param('chapterWid') chapterWid: string,
    @Body() dto: UpdateChapterDto,
  ) {
    return this.templatesService.updateChapter(wid, chapterWid, dto);
  }

  @Delete(':wid/chapters/:chapterWid')
  @ApiOperation({ summary: 'Supprimer un chapitre' })
  deleteChapter(
    @Param('wid') wid: string,
    @Param('chapterWid') chapterWid: string,
  ) {
    return this.templatesService.deleteChapter(wid, chapterWid);
  }

  @Put(':wid/chapters/reorder')
  @ApiOperation({ summary: 'Reordonner les chapitres d un modele' })
  reorderChapters(@Param('wid') wid: string, @Body() dto: ReorderChaptersDto) {
    return this.templatesService.reorderChapters(wid, dto);
  }

  // ── Sub-Chapters L1 ──────────────────────────────────────────

  @Post(':wid/chapters/:chapterWid/subchapters')
  @ApiOperation({ summary: 'Ajouter un sous-chapitre L1 a un chapitre' })
  addSubChapterL1(
    @Param('chapterWid') chapterWid: string,
    @Body() dto: CreateSubChapterL1Dto,
  ) {
    return this.templatesService.addSubChapterL1(chapterWid, dto);
  }

  @Patch(':wid/chapters/:chapterWid/subchapters/:scWid')
  @ApiOperation({ summary: 'Mettre a jour un sous-chapitre L1' })
  updateSubChapterL1(
    @Param('scWid') scWid: string,
    @Body() dto: UpdateSubChapterL1Dto,
  ) {
    return this.templatesService.updateSubChapterL1(scWid, dto);
  }

  @Delete(':wid/chapters/:chapterWid/subchapters/:scWid')
  @ApiOperation({ summary: 'Supprimer un sous-chapitre L1' })
  deleteSubChapterL1(@Param('scWid') scWid: string) {
    return this.templatesService.deleteSubChapterL1(scWid);
  }

  // ── Sub-Chapters L2 ──────────────────────────────────────────

  @Post(':wid/chapters/:chapterWid/subchapters/:scWid/subchapters')
  @ApiOperation({ summary: 'Ajouter un sous-chapitre L2 a un sous-chapitre L1' })
  addSubChapterL2(
    @Param('scWid') scWid: string,
    @Body() dto: CreateSubChapterL2Dto,
  ) {
    return this.templatesService.addSubChapterL2(scWid, dto);
  }

  @Patch(':wid/chapters/:chapterWid/subchapters/:scWid/subchapters/:sc2Wid')
  @ApiOperation({ summary: 'Mettre a jour un sous-chapitre L2' })
  updateSubChapterL2(
    @Param('sc2Wid') sc2Wid: string,
    @Body() dto: UpdateSubChapterL2Dto,
  ) {
    return this.templatesService.updateSubChapterL2(sc2Wid, dto);
  }

  @Delete(':wid/chapters/:chapterWid/subchapters/:scWid/subchapters/:sc2Wid')
  @ApiOperation({ summary: 'Supprimer un sous-chapitre L2' })
  deleteSubChapterL2(@Param('sc2Wid') sc2Wid: string) {
    return this.templatesService.deleteSubChapterL2(sc2Wid);
  }
}
