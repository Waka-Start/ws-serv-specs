-- AlterTable
ALTER TABLE "waka_spec_chapter_content" ADD COLUMN "evaluation_details" JSONB,
ADD COLUMN "evaluated_at" TIMESTAMPTZ;
