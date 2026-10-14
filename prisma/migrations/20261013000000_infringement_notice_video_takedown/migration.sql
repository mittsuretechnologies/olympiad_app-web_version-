-- Purely additive: links an infringement notice to the video it is about and
-- records the copyright takedown and its 21-day review. Existing notices stay
-- unlinked (all new columns NULL). Safe to re-run — each step is guarded.

ALTER TABLE "public"."InfringementNotice"
  ADD COLUMN IF NOT EXISTS "videoId"              TEXT,
  ADD COLUMN IF NOT EXISTS "disabledAt"           TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "disabledById"         TEXT,
  ADD COLUMN IF NOT EXISTS "disabledByName"       TEXT,
  ADD COLUMN IF NOT EXISTS "videoPrevStatus"      TEXT,
  ADD COLUMN IF NOT EXISTS "reviewDueAt"          TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "reviewReminderSentAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "reviewOutcome"        TEXT,
  ADD COLUMN IF NOT EXISTS "reviewedAt"           TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "InfringementNotice_videoId_idx"     ON "public"."InfringementNotice"("videoId");
CREATE INDEX IF NOT EXISTS "InfringementNotice_reviewDueAt_idx" ON "public"."InfringementNotice"("reviewDueAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InfringementNotice_videoId_fkey') THEN
    ALTER TABLE "public"."InfringementNotice"
      ADD CONSTRAINT "InfringementNotice_videoId_fkey"
      FOREIGN KEY ("videoId") REFERENCES "public"."Video"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
