-- CreateTable: ReelShare
CREATE TABLE IF NOT EXISTS "public"."ReelShare" (
    "id"          TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "videoId"     TEXT NOT NULL,
    "senderId"    TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "sentAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReelShare_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ReelShare_recipientId_idx"        ON "public"."ReelShare"("recipientId");
CREATE INDEX IF NOT EXISTS "ReelShare_senderId_recipientId_idx" ON "public"."ReelShare"("senderId", "recipientId");
CREATE INDEX IF NOT EXISTS "ReelShare_videoId_idx"             ON "public"."ReelShare"("videoId");

-- AddForeignKey
ALTER TABLE "public"."ReelShare"
    ADD CONSTRAINT "ReelShare_videoId_fkey"
    FOREIGN KEY ("videoId") REFERENCES "public"."Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."ReelShare"
    ADD CONSTRAINT "ReelShare_senderId_fkey"
    FOREIGN KEY ("senderId") REFERENCES "public"."AppUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."ReelShare"
    ADD CONSTRAINT "ReelShare_recipientId_fkey"
    FOREIGN KEY ("recipientId") REFERENCES "public"."AppUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
