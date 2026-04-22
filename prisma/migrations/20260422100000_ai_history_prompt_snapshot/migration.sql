-- Migration: ai_history_prompt_snapshot
-- Ajoute les colonnes de snapshot de prompt et de versioning sur waka_spec_ai_history

ALTER TABLE "waka_spec_ai_history"
  ADD COLUMN IF NOT EXISTS "model_used"              VARCHAR,
  ADD COLUMN IF NOT EXISTS "mega_prompt_snapshot"    TEXT,
  ADD COLUMN IF NOT EXISTS "chapter_prompt_snapshot" TEXT,
  ADD COLUMN IF NOT EXISTS "prompt_version"          VARCHAR;
