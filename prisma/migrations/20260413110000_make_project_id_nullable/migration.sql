-- AlterTable: make project_id nullable (align with Prisma schema)
ALTER TABLE "waka_specification" ALTER COLUMN "project_id" DROP NOT NULL;
