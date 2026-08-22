-- First-login Terms & Conditions gate for Moderator and Evaluator accounts.
-- The dashboard blocks these roles behind a T&C modal (see /api/staff/terms)
-- until they accept once; this stores that acceptance.
--
-- Purely additive: no column is dropped, existing rows default to
-- termsAccepted = false (i.e. they'll see the popup once on next login).

ALTER TABLE "public"."Moderator"
  ADD COLUMN IF NOT EXISTS "termsAccepted"   BOOLEAN  NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "termsAcceptedAt" TIMESTAMP(3);

ALTER TABLE "public"."TalentEvaluator"
  ADD COLUMN IF NOT EXISTS "termsAccepted"   BOOLEAN  NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "termsAcceptedAt" TIMESTAMP(3);
