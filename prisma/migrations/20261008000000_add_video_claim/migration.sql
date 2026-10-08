-- Moderation claim on videos, so several moderators working the same queue
-- don't review the same clip at once. A claim expires on its own after a few
-- minutes (enforced in the app, not the DB) and is cleared when the decision
-- is saved.
--
-- Purely additive: three nullable columns, nothing existing is changed.

ALTER TABLE "public"."Video"
  ADD COLUMN IF NOT EXISTS "claimedById"   TEXT,
  ADD COLUMN IF NOT EXISTS "claimedByName" TEXT,
  ADD COLUMN IF NOT EXISTS "claimedAt"     TIMESTAMP(3);
