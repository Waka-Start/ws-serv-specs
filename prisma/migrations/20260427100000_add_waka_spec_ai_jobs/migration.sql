-- CreateEnum
CREATE TYPE "EnumAiJobType" AS ENUM ('VENTILATE', 'GENERATE_CHAPTER', 'MODIFY');

-- CreateEnum
CREATE TYPE "EnumAiJobStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "waka_spec_ai_jobs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "wid" TEXT NOT NULL,
    "type" "EnumAiJobType" NOT NULL,
    "status" "EnumAiJobStatus" NOT NULL DEFAULT 'PENDING',
    "specification_wid" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "input" JSONB NOT NULL,
    "progress" JSONB DEFAULT '{}',
    "result" JSONB,
    "error_message" TEXT,
    "error_code" VARCHAR(50),
    "input_tokens" INTEGER,
    "output_tokens" INTEGER,
    "estimated_cost_cts" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMPTZ,
    "finished_at" TIMESTAMPTZ,

    CONSTRAINT "waka_spec_ai_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "waka_spec_ai_jobs_wid_key" ON "waka_spec_ai_jobs"("wid");

-- CreateIndex
CREATE INDEX "waka_spec_ai_jobs_specification_wid_status_idx" ON "waka_spec_ai_jobs"("specification_wid", "status");

-- CreateIndex
CREATE INDEX "waka_spec_ai_jobs_user_id_created_at_idx" ON "waka_spec_ai_jobs"("user_id", "created_at");
