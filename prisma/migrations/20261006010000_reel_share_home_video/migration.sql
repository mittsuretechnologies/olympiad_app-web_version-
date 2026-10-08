-- Lets a ReelShare point at a Learning / Parenting video (HomeSectionVideo)
-- as well as a user reel (Video), so those videos can be shared in-app like
-- any other reel. Requires 20261006000000_add_home_section_video first.
--
-- Existing rows are untouched: every one already has videoId set, which
-- satisfies the new CHECK constraint (exactly one of the two ids). Safe to
-- re-run — each step is guarded.

ALTER TABLE "public"."ReelShare" ALTER COLUMN "videoId" DROP NOT NULL;

ALTER TABLE "public"."ReelShare" ADD COLUMN IF NOT EXISTS "homeVideoId" TEXT;

CREATE INDEX IF NOT EXISTS "ReelShare_homeVideoId_idx" ON "public"."ReelShare"("homeVideoId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ReelShare_homeVideoId_fkey') THEN
    ALTER TABLE "public"."ReelShare"
      ADD CONSTRAINT "ReelShare_homeVideoId_fkey"
      FOREIGN KEY ("homeVideoId") REFERENCES "public"."HomeSectionVideo"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ReelShare_exactly_one_video') THEN
    ALTER TABLE "public"."ReelShare"
      ADD CONSTRAINT "ReelShare_exactly_one_video"
      CHECK (("videoId" IS NOT NULL) <> ("homeVideoId" IS NOT NULL));
  END IF;
END $$;
