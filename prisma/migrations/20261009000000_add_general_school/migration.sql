-- General Schools: schools that sign up in the mobile app on their own.
--
-- Purely additive: one new column on AppUser (default "USER", so every
-- existing account is unchanged) and one new table. No existing School /
-- Olympiad table is touched.
--
-- Run this BEFORE deploying the code: /api/app/login and /api/app/me read
-- AppUser.accountType.

ALTER TABLE "public"."AppUser" ADD COLUMN IF NOT EXISTS "accountType" TEXT NOT NULL DEFAULT 'USER';

CREATE TABLE IF NOT EXISTS "public"."GeneralSchool" (
    "id"            TEXT         NOT NULL,
    "appUserId"     TEXT         NOT NULL,
    "name"          TEXT         NOT NULL,
    "email"         TEXT         NOT NULL,
    "mobile"        TEXT         NOT NULL,
    "contactPerson" TEXT,
    "state"         TEXT         NOT NULL,
    "district"      TEXT         NOT NULL,
    "city"          TEXT,
    "pincode"       TEXT,
    "address"       TEXT,
    "isActive"      BOOLEAN      NOT NULL DEFAULT true,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeneralSchool_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "GeneralSchool_appUserId_key" ON "public"."GeneralSchool"("appUserId");
CREATE INDEX IF NOT EXISTS "GeneralSchool_isActive_idx" ON "public"."GeneralSchool"("isActive");
CREATE INDEX IF NOT EXISTS "GeneralSchool_state_district_idx" ON "public"."GeneralSchool"("state", "district");

DO $$ BEGIN
  ALTER TABLE "public"."GeneralSchool"
    ADD CONSTRAINT "GeneralSchool_appUserId_fkey"
    FOREIGN KEY ("appUserId") REFERENCES "public"."AppUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
