-- Additive: one new table, nothing existing changes. Safe to re-run.
-- The School Panel's notification bell: one row per school per notification.

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
