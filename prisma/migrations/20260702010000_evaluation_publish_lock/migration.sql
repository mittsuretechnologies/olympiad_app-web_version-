-- AlterTable
ALTER TABLE "VideoEvaluation"
  ADD COLUMN "isPublished" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "publishedAt" TIMESTAMP(3),
  ADD COLUMN "lastEditedBy" TEXT,
  ADD COLUMN "lastEditedAt" TIMESTAMP(3);
