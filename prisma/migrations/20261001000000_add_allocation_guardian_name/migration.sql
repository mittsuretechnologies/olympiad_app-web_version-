-- Purely additive: new nullable column on OlympiadIdAllocation, no existing data touched.
-- Required by the school panel's Allot Student form going forward ("Parent/Guardian
-- name"); rows allotted before this column existed stay NULL.
--
-- Safe to run on any database state:
--   * column already named "fatherName" (an early local-dev version of this
--     change) -> renamed, keeping its values
--   * neither column exists (production)              -> "guardianName" added
--   * "guardianName" already exists                   -> no-op
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'OlympiadIdAllocation' AND column_name = 'fatherName'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'OlympiadIdAllocation' AND column_name = 'guardianName'
  ) THEN
    ALTER TABLE "public"."OlympiadIdAllocation" RENAME COLUMN "fatherName" TO "guardianName";
  ELSE
    ALTER TABLE "public"."OlympiadIdAllocation" ADD COLUMN IF NOT EXISTS "guardianName" TEXT;
  END IF;
END $$;
