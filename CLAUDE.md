# CLAUDE.md - ws-serv-specs

## Role

Service NestJS de gestion des specifications fonctionnelles WakaSpecs.
Base de donnees PostgreSQL dediee (separee de ws-serv-config).

## Port

`3014`

## Endpoints principaux

### Templates (modeles de specification)
```
GET    /api/templates
GET    /api/templates/:wid
POST   /api/templates
PATCH  /api/templates/:wid
DELETE /api/templates/:wid
POST   /api/templates/:wid/chapters
PATCH  /api/templates/:wid/chapters/:chapterWid
DELETE /api/templates/:wid/chapters/:chapterWid
PATCH  /api/templates/:wid/chapters/reorder
POST   /api/templates/:wid/chapters/:chapterWid/subchapters
PATCH  /api/templates/:wid/chapters/:chapterWid/subchapters/:scWid
DELETE /api/templates/:wid/chapters/:chapterWid/subchapters/:scWid
POST   /api/templates/:wid/chapters/:chapterWid/subchapters/:scWid/subchapters
PATCH  /api/templates/:wid/chapters/:chapterWid/subchapters/:scWid/subchapters/:sc2Wid
DELETE /api/templates/:wid/chapters/:chapterWid/subchapters/:scWid/subchapters/:sc2Wid
```

### Specifications (instances editeur)
```
GET    /api/specifications
GET    /api/specifications/:wid
POST   /api/specifications
PATCH  /api/specifications/:wid
DELETE /api/specifications/:wid
GET    /api/specifications/:wid/chapters/:chapterWid
PATCH  /api/specifications/:wid/chapters/:chapterWid
POST   /api/specifications/:wid/chapters/subchapters
DELETE /api/specifications/:wid/chapters/:chapterWid/subchapters/:scWid
GET    /api/specifications/:wid/export
POST   /api/specifications/:wid/save-version
```

### AI (redaction assistee par Claude)
```
POST   /api/ai/ventilate
POST   /api/ai/generate
POST   /api/ai/modify
POST   /api/ai/delete-content
GET    /api/ai/history/:specificationWid
```

### Health
```
GET    /api/healthz
```

## Commandes

```bash
pnpm install
pnpm dev          # Dev avec watch (port 3014)
pnpm build        # Build production
pnpm start:prod   # Demarrage production
pnpm lint         # ESLint
```

## Notes importantes

- Base de donnees dediee `specs` (pas la meme que ws-serv-config)
- Schema Prisma local dans `prisma/schema.prisma`
- Config Prisma 7.x dans `prisma/prisma.config.ts` (url de migration)
- Auth S2S via `x-api-key` header (guard ApiKeyGuard)
- Integration IA via Anthropic SDK (@anthropic-ai/sdk)
- Le BFF route `/api/proxy/specs/*` vers ce service
- Tables : `waka_spec_template*`, `waka_specification`, `waka_spec_chapter_content`, `waka_spec_ai_history`
