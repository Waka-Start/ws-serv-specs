import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ApiKeyGuard } from '../../common/guards/api-key.guard.js';
import { AiService } from './ai.service.js';
import { VentilateDto } from './dto/ventilate.dto.js';
import { GenerateChapterDto } from './dto/generate-chapter.dto.js';
import { ModifyContentDto } from './dto/modify-content.dto.js';
import { DeleteContentDto } from './dto/delete-content.dto.js';
import { TestPromptDto } from './dto/test-prompt.dto.js';
import { SuggestQuestionsDto } from './dto/suggest-questions.dto.js';
import {
  EvaluateChapterDto,
  EvaluateAllChaptersDto,
} from './dto/evaluate-chapter.dto.js';

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
