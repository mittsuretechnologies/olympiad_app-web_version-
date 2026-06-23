-- Add isPrivate field to AppUser
ALTER TABLE "public"."AppUser" ADD COLUMN "isPrivate" BOOLEAN NOT NULL DEFAULT false;

-- Create FollowRequest table
CREATE TABLE "public"."FollowRequest" (
    "id"         TEXT NOT NULL,
    "senderId"   TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "status"     TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FollowRequest_pkey" PRIMARY KEY ("id")
);

-- Unique constraint: one request per sender-receiver pair
CREATE UNIQUE INDEX "FollowRequest_senderId_receiverId_key" ON "public"."FollowRequest"("senderId", "receiverId");

-- Indexes
CREATE INDEX "FollowRequest_senderId_idx"   ON "public"."FollowRequest"("senderId");
CREATE INDEX "FollowRequest_receiverId_idx" ON "public"."FollowRequest"("receiverId");

-- Foreign keys
ALTER TABLE "public"."FollowRequest" ADD CONSTRAINT "FollowRequest_senderId_fkey"
    FOREIGN KEY ("senderId")   REFERENCES "public"."AppUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."FollowRequest" ADD CONSTRAINT "FollowRequest_receiverId_fkey"
    FOREIGN KEY ("receiverId") REFERENCES "public"."AppUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
