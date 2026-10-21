-- Additive: app usage sessions sent by the mobile app (POST /api/app/usage)
-- for Reports → User Activity. New table only; nothing existing changes.
-- Safe to re-run.

CREATE TABLE IF NOT EXISTS "public"."AppUsageSession" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "appUserId" TEXT,
    "platform" TEXT NOT NULL,
    "appVersion" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3) NOT NULL,
    "activeSeconds" INTEGER NOT NULL,
    "idleSeconds" INTEGER NOT NULL,
    "endReason" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppUsageSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AppUsageSession_deviceId_sessionId_key" ON "public"."AppUsageSession"("deviceId", "sessionId");
CREATE INDEX IF NOT EXISTS "AppUsageSession_startedAt_idx" ON "public"."AppUsageSession"("startedAt");
CREATE INDEX IF NOT EXISTS "AppUsageSession_appUserId_startedAt_idx" ON "public"."AppUsageSession"("appUserId", "startedAt");
