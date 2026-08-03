-- Add the Notification columns that prisma/schema.prisma expects but production
-- is missing. Without these, notifyVideoLiked() throws "column
-- Notification.videoId does not exist" — and because lib/notifications.ts
-- swallows its own errors, the like silently succeeds while no notification row
-- is ever written.
--
-- Purely additive: no column is dropped and the 6 existing rows keep their data.
-- Defaults match schema.prisma so existing rows stay valid.

ALTER TABLE "public"."Notification"
  ADD COLUMN IF NOT EXISTS "videoId"        TEXT,
  ADD COLUMN IF NOT EXISTS "count"          INTEGER  NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "recentActorIds" TEXT[]   NOT NULL DEFAULT '{}';

-- Indexes declared on the model.
CREATE INDEX IF NOT EXISTS "Notification_userId_idx"
  ON "public"."Notification"("userId");

CREATE INDEX IF NOT EXISTS "Notification_userId_isRead_idx"
  ON "public"."Notification"("userId", "isRead");

CREATE INDEX IF NOT EXISTS "Notification_userId_videoId_type_isRead_idx"
  ON "public"."Notification"("userId", "videoId", "type", "isRead");
