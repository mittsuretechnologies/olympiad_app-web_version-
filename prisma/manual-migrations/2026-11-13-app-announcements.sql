-- SuperAdmin → App Notifications: a message sent to a chosen set of app users
-- (by user type, state/district, Olympiad class). Each recipient gets one row
-- in their normal app notification list (Notification, type 'ANNOUNCEMENT'),
-- and Olympiad schools also get one in their web School Panel bell
-- (SchoolNotification). AppAnnouncement is the sent log behind the history
-- list and "Delete for everyone".
--
-- Run with:  npx prisma db execute --file prisma/manual-migrations/2026-11-13-app-announcements.sql --schema prisma/schema.prisma
-- Additive and safe to run more than once. NEVER `prisma db push` / `npm run db:sync`.

-- The School Panel bell's table (from migration 20261024010000_add_school_notification,
-- which not every database has had applied).
CREATE TABLE IF NOT EXISTS "public"."SchoolNotification" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "link" TEXT,
    "readAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SchoolNotification_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SchoolNotification_schoolId_createdAt_idx" ON "public"."SchoolNotification"("schoolId", "createdAt");
CREATE INDEX IF NOT EXISTS "SchoolNotification_schoolId_readAt_idx" ON "public"."SchoolNotification"("schoolId", "readAt");
DO $$ BEGIN
  ALTER TABLE "public"."SchoolNotification"
    ADD CONSTRAINT "SchoolNotification_schoolId_fkey" FOREIGN KEY ("schoolId")
    REFERENCES "public"."School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Which announcement a notification row came from, and the link it opens.
ALTER TABLE "public"."Notification" ADD COLUMN IF NOT EXISTS "link" TEXT;
ALTER TABLE "public"."Notification" ADD COLUMN IF NOT EXISTS "broadcastId" TEXT;
CREATE INDEX IF NOT EXISTS "Notification_broadcastId_idx" ON "public"."Notification"("broadcastId");

ALTER TABLE "public"."SchoolNotification" ADD COLUMN IF NOT EXISTS "broadcastId" TEXT;
CREATE INDEX IF NOT EXISTS "SchoolNotification_broadcastId_idx" ON "public"."SchoolNotification"("broadcastId");

-- The sent log.
CREATE TABLE IF NOT EXISTS "public"."AppAnnouncement" (
    "id"            TEXT NOT NULL,
    "title"         TEXT NOT NULL,
    "message"       TEXT NOT NULL,
    "link"          TEXT,
    -- { types, states, districts, classes } as chosen when sending.
    "filters"       JSONB NOT NULL DEFAULT '{}',
    "appRecipients" INTEGER NOT NULL DEFAULT 0,
    "webRecipients" INTEGER NOT NULL DEFAULT 0,
    "createdBy"     TEXT,
    "createdByName" TEXT,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- "Delete for everyone": the rows are removed, this log entry stays.
    "recalledAt"    TIMESTAMP(3),
    "recalledBy"    TEXT,
    CONSTRAINT "AppAnnouncement_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AppAnnouncement_createdAt_idx" ON "public"."AppAnnouncement"("createdAt");
