-- Align production VideoEvaluation with prisma/schema.prisma.
-- Safe because VideoEvaluation currently holds 0 rows (verified before running).
-- Deliberately EXCLUDES the `DROP TABLE celery_taskmeta / celery_tasksetmeta`
-- statements that `prisma migrate diff` generates: those tables belong to
-- olympiad-checker's Celery workers, which share this database but are not
-- modelled in schema.prisma. Dropping them would break the checker queue.

ALTER TYPE "public"."Kosh" ADD VALUE IF NOT EXISTS 'MANOMAYA';

DROP INDEX IF EXISTS "public"."VideoEvaluation_videoId_kosh_key";

ALTER TABLE "public"."VideoEvaluation"
  DROP COLUMN IF EXISTS "confidenceScore",
  DROP COLUMN IF EXISTS "creativityScore",
  DROP COLUMN IF EXISTS "kosh",
  DROP COLUMN IF EXISTS "presentationScore",
  DROP COLUMN IF EXISTS "techniqueScore";

ALTER TABLE "public"."VideoEvaluation"
  ADD COLUMN IF NOT EXISTS "coordinationScore"       INTEGER NOT NULL,
  ADD COLUMN IF NOT EXISTS "memoryEnergyScore"       INTEGER NOT NULL,
  ADD COLUMN IF NOT EXISTS "imaginationEmotionScore" INTEGER NOT NULL,
  ADD COLUMN IF NOT EXISTS "focusLanguageScore"      INTEGER NOT NULL,
  ADD COLUMN IF NOT EXISTS "creativityJoyScore"      INTEGER NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "VideoEvaluation_videoId_key"
  ON "public"."VideoEvaluation"("videoId");
