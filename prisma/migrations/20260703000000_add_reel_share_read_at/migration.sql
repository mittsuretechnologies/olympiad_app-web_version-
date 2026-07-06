-- AlterTable: ReelShare — track when the recipient has viewed a shared reel
ALTER TABLE "public"."ReelShare"
    ADD COLUMN IF NOT EXISTS "readAt" TIMESTAMP(3);
