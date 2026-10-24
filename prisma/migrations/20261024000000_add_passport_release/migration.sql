-- Additive: one new table, nothing existing changes. Safe to re-run.
-- A row means SuperAdmin has released that school's student passports to it.

CREATE TABLE IF NOT EXISTS "public"."PassportRelease" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "releasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedBy" TEXT,

    CONSTRAINT "PassportRelease_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PassportRelease_schoolId_key" ON "public"."PassportRelease"("schoolId");

DO $$ BEGIN
  ALTER TABLE "public"."PassportRelease"
    ADD CONSTRAINT "PassportRelease_schoolId_fkey" FOREIGN KEY ("schoolId")
    REFERENCES "public"."School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
