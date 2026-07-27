-- Talent Round restructure: each video is scored on 5 criteria (0-4 each),
-- each criterion mapped 1:1 to a kosha. Old 4-criteria, kosh-duplicated rows
-- are dropped (new season — evaluators re-score with the new form).

-- Reset old evaluations (old structure is incompatible with the new one).
DELETE FROM "VideoEvaluation";

-- Add MANOMAYA to the Kosh enum (video evaluations now cover all 5 koshas).
ALTER TYPE "Kosh" ADD VALUE IF NOT EXISTS 'MANOMAYA';

-- Drop the per-kosh duplication: back to one row per video.
DROP INDEX IF EXISTS "VideoEvaluation_videoId_kosh_key";
ALTER TABLE "VideoEvaluation" DROP COLUMN IF EXISTS "kosh";
CREATE UNIQUE INDEX "VideoEvaluation_videoId_key" ON "VideoEvaluation"("videoId");

-- Replace old criteria columns with the 5 kosha-mapped criteria.
ALTER TABLE "VideoEvaluation"
  DROP COLUMN IF EXISTS "confidenceScore",
  DROP COLUMN IF EXISTS "creativityScore",
  DROP COLUMN IF EXISTS "techniqueScore",
  DROP COLUMN IF EXISTS "presentationScore",
  ADD COLUMN "coordinationScore" INTEGER NOT NULL,
  ADD COLUMN "memoryEnergyScore" INTEGER NOT NULL,
  ADD COLUMN "imaginationEmotionScore" INTEGER NOT NULL,
  ADD COLUMN "focusLanguageScore" INTEGER NOT NULL,
  ADD COLUMN "creativityJoyScore" INTEGER NOT NULL;
