-- MittTV "Learn by Class": Continue Watching / Resume for class videos.
--
-- Class videos are read live from the Mittsure ERP (src/lib/mittTvErp.ts) and
-- are NOT stored in MittTvVideo, so MittTvProgress (which points at
-- MittTvVideo) can't hold them. This table keeps only where each user stopped
-- in a class video — the video's ERP id ("erp-<chapterId>-<hash>"), seconds —
-- nothing of the ERP's content. The Continue Watching card itself is still
-- built live from the ERP.
--
--   MittTvErpProgress   one row per user and class video
--
-- Run with:  npx prisma db execute --file prisma/manual-migrations/2026-11-19-mitttv-erp-progress.sql --schema prisma/schema.prisma
-- Additive and safe to run more than once. NEVER `prisma db push` / `npm run db:sync`.

CREATE TABLE IF NOT EXISTS "public"."MittTvErpProgress" (
    "id"          TEXT NOT NULL,
    "userId"      TEXT NOT NULL,
    -- The class video's id in MittTV: erp-<ERP chapter id>-<hash of its file path>.
    "videoKey"    TEXT NOT NULL,
    "positionSec" INTEGER NOT NULL DEFAULT 0,
    "durationSec" INTEGER NOT NULL DEFAULT 0,
    -- Watched to (nearly) the end: left out of Continue Watching.
    "finished"    BOOLEAN NOT NULL DEFAULT false,
    -- The user removed it from Continue Watching (cleared on the next play).
    "hidden"      BOOLEAN NOT NULL DEFAULT false,
    "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MittTvErpProgress_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "MittTvErpProgress_userId_videoKey_key" ON "public"."MittTvErpProgress"("userId", "videoKey");
CREATE INDEX IF NOT EXISTS "MittTvErpProgress_userId_updatedAt_idx" ON "public"."MittTvErpProgress"("userId", "updatedAt");
DO $$ BEGIN
  ALTER TABLE "public"."MittTvErpProgress" ADD CONSTRAINT "MittTvErpProgress_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "public"."AppUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
