-- MittFest flag on Video, powering the "MittFest" row on the app home screen.
--
-- The upload screen has always shown an "Is this video for MittFest?"
-- checkbox, but it was purely a client-side gate that unlocked the Submit
-- button — the answer was never included in the POST /api/app/videos payload
-- and there was no column to store it in. This adds that column and the app
-- now sends the value.
--
-- Purely additive. Existing rows get false rather than a backfill: there is no
-- historical record of what any past uploader actually ticked, so marking them
-- true would be inventing data. The home row therefore starts empty and fills
-- as new videos are uploaded and approved.

ALTER TABLE "public"."Video"
  ADD COLUMN IF NOT EXISTS "isMittfest" BOOLEAN NOT NULL DEFAULT false;

-- The home feed queries this alongside the standard approved/public filters.
CREATE INDEX IF NOT EXISTS "Video_isMittfest_idx" ON "public"."Video" ("isMittfest");

-- Backfill anyone who already tagged #mittfest. Unlike the checkbox (whose
-- answer was never stored, so there's nothing to recover), the hashtag IS in
-- the data — these uploaders stated their intent and it would be wrong to
-- ignore it just because the flag didn't exist yet.
--
-- tags is a comma-joined string, so the match is anchored on comma boundaries
-- to avoid matching a tag that merely contains the word (e.g. "premittfest").
-- Stored tags have their leading '#' stripped at entry, but older/web-entered
-- rows may not, hence the optional '#'.
UPDATE "public"."Video"
SET "isMittfest" = true
WHERE "isMittfest" = false
  AND "tags" IS NOT NULL
  AND ',' || replace("tags", ' ', '') || ',' ~* ',#?mittfest,';
