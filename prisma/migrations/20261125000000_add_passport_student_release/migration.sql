-- Additive: one new table, nothing existing changes. Safe to re-run.
-- A row means that ONE student's passport is visible to the student in the
-- mittmee app (shown by SuperAdmin or by the school, per student).

CREATE TABLE IF NOT EXISTS "public"."StudentPassportRelease" (
    "id" TEXT NOT NULL,
    "olympiadCode" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "releasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedBy" TEXT,
    "releasedByRole" TEXT,

    CONSTRAINT "StudentPassportRelease_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "StudentPassportRelease_olympiadCode_key" ON "public"."StudentPassportRelease"("olympiadCode");
CREATE INDEX IF NOT EXISTS "StudentPassportRelease_schoolId_idx" ON "public"."StudentPassportRelease"("schoolId");

DO $$ BEGIN
  ALTER TABLE "public"."StudentPassportRelease"
    ADD CONSTRAINT "StudentPassportRelease_schoolId_fkey" FOREIGN KEY ("schoolId")
    REFERENCES "public"."School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
