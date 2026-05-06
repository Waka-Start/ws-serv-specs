import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ApiKeyGuard } from '../../common/guards/api-key.guard.js';
import { AiService } from './ai.service.js';
import { VentilateDto } from './dto/ventilate.dto.js';
import { GenerateChapterDto } from './dto/generate-chapter.dto.js';
import { GenerateChapterResponseDto } from './dto/generate-chapter-response.dto.js';
import { ModifyContentDto } from './dto/modify-content.dto.js';
import { DeleteContentDto } from './dto/delete-content.dto.js';
import { TestPromptDto } from './dto/test-prompt.dto.js';
import { SuggestQuestionsDto } from './dto/suggest-questions.dto.js';
import {
  EvaluateChapterDto,
  EvaluateAllChaptersDto,
} from './dto/evaluate-chapter.dto.js';
import {
  VentilateSubChaptersDto,
  VentilateSubChaptersResponseDto,
} from './dto/ventilate-subchapters.dto.js';

@Controller('ai')
@ApiTags('ai')
@UseGuards(ApiKeyGuard)
@ApiSecurity('api-key')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('ventilate')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Ventiler un texte initial dans tous les chapitres (async — retourne un jobWid)',
  })
  @ApiResponse({ status: 202, description: 'Job créé — polling via GET /api/ai/jobs/:jobWid' })
  @ApiResponse({ status: 409, description: 'Un job VENTILATE est déjà en cours pour cette specification' })
  ventilate(@Body() dto: VentilateDto) {
    return this.aiService.ventilate(dto);
  }

  @Post('generate')
  @ApiOperation({
    summary: 'Generer ou enrichir le contenu d un chapitre avec l IA',
  })
  @ApiResponse({ status: 201, type: GenerateChapterResponseDto })
  generateChapter(@Body() dto: GenerateChapterDto): Promise<GenerateChapterResponseDto> {
    return this.aiService.generateChapter(dto);
  }

  @Post('ventilate-subchapters/:chapterWid')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Ventiler le contenu d un chapitre dans ses sous-chapitres template (async — retourne un jobId)',
  })
  @ApiParam({ name: 'chapterWid', description: 'WID du chapitre template a ventiler' })
  @ApiResponse({ status: 202, type: VentilateSubChaptersResponseDto, description: 'Job cree — polling via GET /api/ai/jobs/:jobId' })
  @ApiResponse({ status: 404, description: 'Specification ou chapitre non trouve' })
  @ApiResponse({ status: 409, description: 'Chapitre vide ou job deja en cours' })
  ventilateSubChapters(
    @Param('chapterWid') chapterWid: string,
    @Body() dto: VentilateSubChaptersDto,
  ): Promise<VentilateSubChaptersResponseDto> {
    return this.aiService.ventilateSubChapters(chapterWid, dto);
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

  @Post('suggest-questions')
  @ApiOperation({
    summary:
      'Generer des questions contextuelles pour aider la redaction d un chapitre',
  })
  suggestQuestions(@Body() dto: SuggestQuestionsDto) {
    return this.aiService.suggestQuestions(dto);
  }

  @Post('test-prompt')
  @ApiOperation({
    summary:
      'Tester un prompt de chapitre sans creer de specification (limite a 500 tokens)',
  })
  testPrompt(@Body() dto: TestPromptDto) {
    return this.aiService.testPrompt(dto);
  }

  @Post('evaluate-chapter')
  @ApiOperation({
    summary: 'Evaluer la completude d un chapitre par rapport aux exigences du template',
  })
  evaluateChapter(@Body() dto: EvaluateChapterDto) {
    return this.aiService.evaluateChapter(dto);
  }

  @Post('evaluate-all')
  @ApiOperation({
    summary: 'Evaluer la completude de tous les chapitres d une specification',
  })
  evaluateAllChapters(@Body() dto: EvaluateAllChaptersDto) {
    return this.aiService.evaluateAllChapters(dto);
  }

  @Get('history/:specificationWid')
  @ApiOperation({
    summary: 'Recuperer l historique des interactions IA d une specification',
  })
  getHistory(@Param('specificationWid') specificationWid: string) {
    return this.aiService.getHistory(specificationWid);
  }
}
