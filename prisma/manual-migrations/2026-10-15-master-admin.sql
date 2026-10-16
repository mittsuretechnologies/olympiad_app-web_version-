-- Master Admin role (level 2 under SuperAdmin).
--
-- Additive only: creates the new "MasterAdmin" table and adds one nullable
-- column (+ unique index + FK) to "IndividualPermissions". No existing row is
-- updated or deleted, no existing column is changed. Every statement is
-- guarded with IF NOT EXISTS, so running it twice is harmless.
--
-- Generated with `prisma migrate diff` from the previous schema.prisma to the
-- current one, then made idempotent by hand.

BEGIN;

CREATE TABLE IF NOT EXISTS "public"."MasterAdmin" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "mobile" TEXT,
    "jobTitle" TEXT,
    "avatar" TEXT,
    "password" TEXT NOT NULL,
    "plainPassword" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MasterAdmin_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MasterAdmin_username_key" ON "public"."MasterAdmin"("username");
CREATE UNIQUE INDEX IF NOT EXISTS "MasterAdmin_email_key" ON "public"."MasterAdmin"("email");

ALTER TABLE "public"."IndividualPermissions" ADD COLUMN IF NOT EXISTS "masterAdminId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "IndividualPermissions_masterAdminId_key" ON "public"."IndividualPermissions"("masterAdminId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'IndividualPermissions_masterAdminId_fkey') THEN
    ALTER TABLE "public"."IndividualPermissions"
      ADD CONSTRAINT "IndividualPermissions_masterAdminId_fkey"
      FOREIGN KEY ("masterAdminId") REFERENCES "public"."MasterAdmin"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Expect: one row for the table, one for the new column.
SELECT 'MasterAdmin table' AS item, to_regclass('"public"."MasterAdmin"')::text AS present
UNION ALL
SELECT 'IndividualPermissions.masterAdminId', column_name
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'IndividualPermissions' AND column_name = 'masterAdminId';

COMMIT;
