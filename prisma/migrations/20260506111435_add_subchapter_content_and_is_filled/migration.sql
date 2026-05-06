-- AlterEnum
ALTER TYPE "EnumAiJobType" ADD VALUE 'VENTILATE_SUBCHAPTERS';

-- AlterTable
ALTER TABLE "waka_spec_ai_history" ALTER COLUMN "model_used" SET DATA TYPE TEXT,
ALTER COLUMN "prompt_version" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "waka_spec_chapter_content" ADD COLUMN     "is_filled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "waka_spec_sub_chapter_content" (
    "id" SERIAL NOT NULL,
    "wid" TEXT NOT NULL,
    "specification_id" INTEGER NOT NULL,
    "chapter_content_id" INTEGER NOT NULL,
    "sub_chapter_l1_wid" TEXT NOT NULL,
    "sub_chapter_l2_wid" TEXT NOT NULL DEFAULT '',
    "title" TEXT NOT NULL,
    "content" TEXT,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "order" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "waka_spec_sub_chapter_content_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "waka_spec_sub_chapter_content_wid_key" ON "waka_spec_sub_chapter_content"("wid");

-- CreateIndex
CREATE INDEX "waka_spec_sub_chapter_content_chapter_content_id_order_idx" ON "waka_spec_sub_chapter_content"("chapter_content_id", "order");

-- CreateIndex
CREATE UNIQUE INDEX "waka_spec_sub_chapter_content_chapter_content_id_sub_chapte_key" ON "waka_spec_sub_chapter_content"("chapter_content_id", "sub_chapter_l1_wid", "sub_chapter_l2_wid");

-- AddForeignKey
ALTER TABLE "waka_spec_sub_chapter_content" ADD CONSTRAINT "waka_spec_sub_chapter_content_specification_id_fkey" FOREIGN KEY ("specification_id") REFERENCES "waka_specification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waka_spec_sub_chapter_content" ADD CONSTRAINT "waka_spec_sub_chapter_content_chapter_content_id_fkey" FOREIGN KEY ("chapter_content_id") REFERENCES "waka_spec_chapter_content"("id") ON DELETE CASCADE ON UPDATE CASCADE;
