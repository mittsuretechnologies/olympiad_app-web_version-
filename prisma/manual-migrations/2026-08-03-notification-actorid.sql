-- Adds Notification.actorId, which schema.prisma now declares and the code
-- reads: /api/app/notifications selects it, and the FOLLOW / FOLLOW_REQUEST
-- helpers write and dedupe on it.
--
-- MUST be applied BEFORE deploying the matching code. Unlike the earlier
-- notification drift (which failed silently inside a catch), the notifications
-- feed route SELECTs this column directly — without it that endpoint throws and
-- returns 500 for every user.
--
-- Purely additive and nullable: existing rows are untouched and stay valid.

ALTER TABLE "public"."Notification"
  ADD COLUMN IF NOT EXISTS "actorId" TEXT;

-- Supports the (userId, type, actorId) lookup the follow helpers use to dedupe
-- repeat follow/unfollow cycles into a single notification row.
CREATE INDEX IF NOT EXISTS "Notification_userId_type_actorId_idx"
  ON "public"."Notification"("userId", "type", "actorId");
