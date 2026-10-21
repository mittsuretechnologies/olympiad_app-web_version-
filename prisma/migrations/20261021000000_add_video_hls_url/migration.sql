-- Additive: adaptive-quality (HLS) link for a reel, filled in by scripts/hls-worker.mjs.
-- Nothing existing is changed. Safe to re-run.
ALTER TABLE "public"."Video" ADD COLUMN IF NOT EXISTS "hlsUrl" TEXT;
