-- Mandatory video-quality field for the moderation dashboard. A moderator now
-- must pick HIGH / MEDIUM / LOW before a video can be approved (see
-- /api/dashboard/videos POST, which rejects an APPROVED status with no
-- quality). Purely additive: existing rows (already PENDING/APPROVED/
-- REJECTED) get NULL, which is correct for anything not yet (re-)approved
-- through the updated flow — there is no historical quality data to backfill.

ALTER TABLE "public"."Video"
  ADD COLUMN IF NOT EXISTS "quality" TEXT;
