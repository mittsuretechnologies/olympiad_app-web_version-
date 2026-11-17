-- MittTV (SuperAdmin → MittTV): the app's Netflix-style video screen, opened
-- from the floating MittTV button on Home.
--
--   MittTvVideo     the videos (uploaded here; `source` / `externalId` / `meta`
--                   are for videos pulled in later from the class & subject
--                   platform, so that needs no new columns)
--   MittTvRow       the sections of the screen, in order: the big banner,
--                   Continue Watching, hand-picked rows (Stories…), and the
--                   automatic rows (most watched, newest)
--   MittTvRowItem   the videos of the banner and of each hand-picked row
--   MittTvProgress  where each user stopped in a video (Continue Watching)
--   MittTvView      one row per user, video and India-time day (Most Watched)
--
-- The on/off switch and who can see MittTV live in AppSetting 'MITTTV'. The
-- default rows are created by code on the first read (src/lib/mittTv.ts).
--
-- Run with:  npx prisma db execute --file prisma/manual-migrations/2026-11-17-mitttv.sql --schema prisma/schema.prisma
-- Additive and safe to run more than once. NEVER `prisma db push` / `npm run db:sync`.

CREATE TABLE IF NOT EXISTS "public"."MittTvVideo" (
    "id"           TEXT NOT NULL,
    "title"        TEXT NOT NULL,
    "description"  TEXT NOT NULL DEFAULT '',
    "videoUrl"     TEXT NOT NULL,
    "thumbnailUrl" TEXT NOT NULL DEFAULT '',
    "posterUrl"    TEXT NOT NULL DEFAULT '',
    "durationSec"  INTEGER NOT NULL DEFAULT 0,
    "tags"         TEXT NOT NULL DEFAULT '',
    "source"       TEXT NOT NULL DEFAULT 'UPLOAD',
    "externalId"   TEXT,
    "meta"         JSONB NOT NULL DEFAULT '{}',
    "isActive"     BOOLEAN NOT NULL DEFAULT true,
    "viewsCount"   INTEGER NOT NULL DEFAULT 0,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MittTvVideo_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "MittTvVideo_isActive_createdAt_idx" ON "public"."MittTvVideo"("isActive", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "MittTvVideo_source_externalId_key" ON "public"."MittTvVideo"("source", "externalId");

CREATE TABLE IF NOT EXISTS "public"."MittTvRow" (
    "id"        TEXT NOT NULL,
    "title"     TEXT NOT NULL,
    "subtitle"  TEXT NOT NULL DEFAULT '',
    -- BANNER | CONTINUE | CURATED | MOST_WATCHED | NEW
    "kind"      TEXT NOT NULL,
    -- LANDSCAPE | POSTER | TOP10 | LARGE
    "style"     TEXT NOT NULL DEFAULT 'LANDSCAPE',
    -- Per kind: banner { mode, limit, days }, automatic rows { limit, days }.
    "settings"  JSONB NOT NULL DEFAULT '{}',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MittTvRow_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "MittTvRow_sortOrder_idx" ON "public"."MittTvRow"("sortOrder");

CREATE TABLE IF NOT EXISTS "public"."MittTvRowItem" (
    "id"        TEXT NOT NULL,
    "rowId"     TEXT NOT NULL,
    "videoId"   TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MittTvRowItem_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "MittTvRowItem_rowId_videoId_key" ON "public"."MittTvRowItem"("rowId", "videoId");
CREATE INDEX IF NOT EXISTS "MittTvRowItem_rowId_sortOrder_idx" ON "public"."MittTvRowItem"("rowId", "sortOrder");
CREATE INDEX IF NOT EXISTS "MittTvRowItem_videoId_idx" ON "public"."MittTvRowItem"("videoId");
DO $$ BEGIN
  ALTER TABLE "public"."MittTvRowItem" ADD CONSTRAINT "MittTvRowItem_rowId_fkey"
    FOREIGN KEY ("rowId") REFERENCES "public"."MittTvRow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "public"."MittTvRowItem" ADD CONSTRAINT "MittTvRowItem_videoId_fkey"
    FOREIGN KEY ("videoId") REFERENCES "public"."MittTvVideo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "public"."MittTvProgress" (
    "id"          TEXT NOT NULL,
    "userId"      TEXT NOT NULL,
    "videoId"     TEXT NOT NULL,
    "positionSec" INTEGER NOT NULL DEFAULT 0,
    "durationSec" INTEGER NOT NULL DEFAULT 0,
    -- Watched to (nearly) the end: left out of Continue Watching.
    "finished"    BOOLEAN NOT NULL DEFAULT false,
    -- The user removed it from Continue Watching (cleared on the next play).
    "hidden"      BOOLEAN NOT NULL DEFAULT false,
    "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MittTvProgress_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "MittTvProgress_userId_videoId_key" ON "public"."MittTvProgress"("userId", "videoId");
CREATE INDEX IF NOT EXISTS "MittTvProgress_userId_updatedAt_idx" ON "public"."MittTvProgress"("userId", "updatedAt");
CREATE INDEX IF NOT EXISTS "MittTvProgress_videoId_idx" ON "public"."MittTvProgress"("videoId");
DO $$ BEGIN
  ALTER TABLE "public"."MittTvProgress" ADD CONSTRAINT "MittTvProgress_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "public"."AppUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "public"."MittTvProgress" ADD CONSTRAINT "MittTvProgress_videoId_fkey"
    FOREIGN KEY ("videoId") REFERENCES "public"."MittTvVideo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "public"."MittTvView" (
    "id"        TEXT NOT NULL,
    "videoId"   TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    -- India-time date, YYYY-MM-DD: a user counts once per video per day.
    "day"       TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MittTvView_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "MittTvView_videoId_userId_day_key" ON "public"."MittTvView"("videoId", "userId", "day");
CREATE INDEX IF NOT EXISTS "MittTvView_day_idx" ON "public"."MittTvView"("day");
CREATE INDEX IF NOT EXISTS "MittTvView_userId_idx" ON "public"."MittTvView"("userId");
DO $$ BEGIN
  ALTER TABLE "public"."MittTvView" ADD CONSTRAINT "MittTvView_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "public"."AppUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "public"."MittTvView" ADD CONSTRAINT "MittTvView_videoId_fkey"
    FOREIGN KEY ("videoId") REFERENCES "public"."MittTvVideo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
