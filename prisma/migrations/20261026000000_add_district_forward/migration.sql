-- Additive: one new table, nothing existing changes. Safe to re-run.
-- A row means SuperAdmin forwarded that student to the district level.

CREATE TABLE IF NOT EXISTS "public"."DistrictForward" (
    "id" TEXT NOT NULL,
    "olympiadCode" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "holisticPercent" DOUBLE PRECISION NOT NULL,
    "forwardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "forwardedBy" TEXT,

    CONSTRAINT "DistrictForward_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DistrictForward_olympiadCode_key" ON "public"."DistrictForward"("olympiadCode");
CREATE INDEX IF NOT EXISTS "DistrictForward_schoolId_idx" ON "public"."DistrictForward"("schoolId");

DO $$ BEGIN
  ALTER TABLE "public"."DistrictForward"
    ADD CONSTRAINT "DistrictForward_schoolId_fkey" FOREIGN KEY ("schoolId")
    REFERENCES "public"."School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
