-- CreateEnum
CREATE TYPE "SpecificationStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "AIAction" AS ENUM ('VENTILATE', 'GENERATE', 'MODIFY', 'DELETE');

-- CreateTable
CREATE TABLE "waka_spec_template" (
    "id" SERIAL NOT NULL,
    "wid" TEXT NOT NULL,
    "title" VARCHAR(100) NOT NULL,
    "user_description" TEXT NOT NULL,
    "doc_description" TEXT NOT NULL,
    "mega_prompt" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT NOT NULL,

    CONSTRAINT "waka_spec_template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "waka_spec_template_chapter" (
    "id" SERIAL NOT NULL,
    "wid" TEXT NOT NULL,
    "template_id" INTEGER NOT NULL,
    "title" VARCHAR(40) NOT NULL,
    "user_description" TEXT,
    "doc_description" TEXT,
    "prompt" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "is_variable" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "waka_spec_template_chapter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "waka_spec_template_sub_chapter_l1" (
    "id" SERIAL NOT NULL,
    "wid" TEXT NOT NULL,
    "chapter_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "is_variable" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "waka_spec_template_sub_chapter_l1_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "waka_spec_template_sub_chapter_l2" (
    "id" SERIAL NOT NULL,
    "wid" TEXT NOT NULL,
    "sub_chapter_l1_id" INTEGER NOT NULL,
    "title" VARCHAR(25) NOT NULL,
    "order" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "waka_spec_template_sub_chapter_l2_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "waka_specification" (
    "id" SERIAL NOT NULL,
    "wid" TEXT NOT NULL,
    "template_id" INTEGER NOT NULL,
    "project_id" TEXT NOT NULL,
    "step_id" TEXT,
    "name" TEXT NOT NULL,
    "status" "SpecificationStatus" NOT NULL DEFAULT 'DRAFT',
    "global_progress" INTEGER NOT NULL DEFAULT 0,
    "initial_text" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT NOT NULL,
    "updated_by" TEXT,

    CONSTRAINT "waka_specification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "waka_spec_chapter_content" (
    "id" SERIAL NOT NULL,
    "wid" TEXT NOT NULL,
    "specification_id" INTEGER NOT NULL,
    "chapter_wid" TEXT NOT NULL,
    "chapter_title" TEXT NOT NULL,
    "chapter_order" INTEGER NOT NULL,
    "content" TEXT,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "is_auto_saved" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "waka_spec_chapter_content_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "waka_spec_ai_history" (
    "id" SERIAL NOT NULL,
    "specification_id" INTEGER NOT NULL,
    "chapter_wid" TEXT,
    "action" "AIAction" NOT NULL,
    "user_instruction" TEXT,
    "ai_response" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "waka_spec_ai_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "waka_spec_template_wid_key" ON "waka_spec_template"("wid");

-- CreateIndex
CREATE UNIQUE INDEX "waka_spec_template_chapter_wid_key" ON "waka_spec_template_chapter"("wid");

-- CreateIndex
CREATE UNIQUE INDEX "waka_spec_template_sub_chapter_l1_wid_key" ON "waka_spec_template_sub_chapter_l1"("wid");

-- CreateIndex
CREATE UNIQUE INDEX "waka_spec_template_sub_chapter_l2_wid_key" ON "waka_spec_template_sub_chapter_l2"("wid");

-- CreateIndex
CREATE UNIQUE INDEX "waka_specification_wid_key" ON "waka_specification"("wid");

-- CreateIndex
CREATE UNIQUE INDEX "waka_spec_chapter_content_wid_key" ON "waka_spec_chapter_content"("wid");

-- AddForeignKey
ALTER TABLE "waka_spec_template_chapter" ADD CONSTRAINT "waka_spec_template_chapter_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "waka_spec_template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waka_spec_template_sub_chapter_l1" ADD CONSTRAINT "waka_spec_template_sub_chapter_l1_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "waka_spec_template_chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waka_spec_template_sub_chapter_l2" ADD CONSTRAINT "waka_spec_template_sub_chapter_l2_sub_chapter_l1_id_fkey" FOREIGN KEY ("sub_chapter_l1_id") REFERENCES "waka_spec_template_sub_chapter_l1"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waka_specification" ADD CONSTRAINT "waka_specification_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "waka_spec_template"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waka_spec_chapter_content" ADD CONSTRAINT "waka_spec_chapter_content_specification_id_fkey" FOREIGN KEY ("specification_id") REFERENCES "waka_specification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waka_spec_ai_history" ADD CONSTRAINT "waka_spec_ai_history_specification_id_fkey" FOREIGN KEY ("specification_id") REFERENCES "waka_specification"("id") ON DELETE CASCADE ON UPDATE CASCADE;
