-- AlterTable: aggregation fields for VIDEO_LIKED notifications
ALTER TABLE "public"."Notification" ADD COLUMN "videoId" TEXT;
ALTER TABLE "public"."Notification" ADD COLUMN "count" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "public"."Notification" ADD COLUMN "recentActorIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Index
CREATE INDEX "Notification_userId_videoId_type_isRead_idx" ON "public"."Notification"("userId", "videoId", "type", "isRead");
