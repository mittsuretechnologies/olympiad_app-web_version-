-- First-login Terms & Conditions gate for Olympiad (student) accounts.
-- Mirrors 2026-08-19-moderator-evaluator-terms.sql for Moderator/Evaluator.
--
-- AppUser.termsAccepted already existed, but both account-creation routes for
-- Olympiad students (school/me/olympiad-ids/allot and .../[code]/register)
-- hard-coded it to true at creation — the student never actually saw or
-- agreed to anything. General (non-Olympiad) signups are unaffected: that
-- flow already puts a real Terms checkbox in front of the user before
-- calling verify-otp-register, which is the one path that legitimately
-- writes true at creation time.
--
-- 1. Adds termsAcceptedAt, so acceptance carries a timestamp like the staff
--    gate does (see /api/app/terms, added alongside this migration).
-- 2. Resets termsAccepted to false for every existing Olympiad account
--    (olympiadId is not null) so each one sees the gate once on next login,
--    per product decision — general/non-Olympiad AppUser rows are untouched.

ALTER TABLE "public"."AppUser"
  ADD COLUMN IF NOT EXISTS "termsAcceptedAt" TIMESTAMP(3);

UPDATE "public"."AppUser"
SET "termsAccepted" = false, "termsAcceptedAt" = NULL
WHERE "olympiadId" IS NOT NULL;
