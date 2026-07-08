-- AlterTable: Video — dedicated public/private visibility for Olympiad (isEvaluation) videos,
-- independent of the existing isPublic flag (which continues to gate the general feeds).
ALTER TABLE "public"."Video"
    ADD COLUMN IF NOT EXISTS "olympiadVisibility" TEXT;

-- Backfill existing Olympiad videos as public by default (preserves current feed behavior
-- for videos already relying on isPublic; new uploads set this explicitly going forward).
UPDATE "public"."Video" SET "olympiadVisibility" = 'public' WHERE "isEvaluation" = true;
