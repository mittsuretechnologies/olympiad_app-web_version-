-- Additive: index for the app home feed's "Most watched this week" row,
-- which counts VideoView rows from the last 7 days on every home load.
-- Without it that query scans the whole (ever-growing) views table.
-- Safe to re-run.

CREATE INDEX IF NOT EXISTS "VideoView_createdAt_videoId_idx" ON "public"."VideoView"("createdAt", "videoId");
