-- Purely additive: new boolean on AppUser, default false.
ALTER TABLE "public"."AppUser" ADD COLUMN IF NOT EXISTS "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

-- Olympiad students who have never logged in are still on the password their
-- school issued, so they get the first-login change too. Anyone who has
-- already logged in (or accepted the terms) is left alone.
UPDATE "public"."AppUser"
SET "mustChangePassword" = true
WHERE "olympiadId" IS NOT NULL
  AND "lastLoginAt" IS NULL
  AND "termsAccepted" = false;
