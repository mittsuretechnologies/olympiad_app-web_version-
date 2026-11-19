-- Additive: one new table, nothing existing changes. Safe to re-run.
-- Device tokens for push notifications (Firebase Cloud Messaging).

CREATE TABLE IF NOT EXISTS "public"."PushToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "appUserId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PushToken_token_key" ON "public"."PushToken"("token");
CREATE INDEX IF NOT EXISTS "PushToken_appUserId_idx" ON "public"."PushToken"("appUserId");

DO $$ BEGIN
  ALTER TABLE "public"."PushToken"
    ADD CONSTRAINT "PushToken_appUserId_fkey" FOREIGN KEY ("appUserId")
    REFERENCES "public"."AppUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
