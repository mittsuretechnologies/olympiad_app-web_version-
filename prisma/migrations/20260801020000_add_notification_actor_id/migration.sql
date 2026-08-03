-- AlterTable: actor reference for FOLLOW / FOLLOW_REQUEST notifications
ALTER TABLE "public"."Notification" ADD COLUMN "actorId" TEXT;
