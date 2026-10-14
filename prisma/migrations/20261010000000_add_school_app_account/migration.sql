-- Olympiad schools get an app account (AppUser) so they can use the mobile app.
--
-- Purely additive: one nullable column on AppUser. Every existing row stays NULL.
-- Run BEFORE deploying the code: /api/app/login and /api/app/me read this column.

ALTER TABLE "public"."AppUser" ADD COLUMN IF NOT EXISTS "schoolRefId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "AppUser_schoolRefId_key" ON "public"."AppUser"("schoolRefId");

DO $$ BEGIN
  ALTER TABLE "public"."AppUser"
    ADD CONSTRAINT "AppUser_schoolRefId_fkey"
    FOREIGN KEY ("schoolRefId") REFERENCES "public"."School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
