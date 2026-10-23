-- Additive: stars on SuperAdmin Learning / Parenting videos. One new column and
-- one new table; nothing existing changes. Safe to re-run.

ALTER TABLE "public"."HomeSectionVideo" ADD COLUMN IF NOT EXISTS "likesCount" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "public"."HomeSectionVideoLike" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HomeSectionVideoLike_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "HomeSectionVideoLike_videoId_userId_key" ON "public"."HomeSectionVideoLike"("videoId", "userId");
CREATE INDEX IF NOT EXISTS "HomeSectionVideoLike_videoId_idx" ON "public"."HomeSectionVideoLike"("videoId");

DO $$ BEGIN
  ALTER TABLE "public"."HomeSectionVideoLike"
    ADD CONSTRAINT "HomeSectionVideoLike_videoId_fkey" FOREIGN KEY ("videoId")
    REFERENCES "public"."HomeSectionVideo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
