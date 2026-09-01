-- Adds termsAccepted tracking, present in schema.prisma but never migrated
-- (schema drift — these columns were added to the schema directly without a
-- corresponding migration, which is what caused production login/OTP routes
-- to fail with "column does not exist").

ALTER TABLE "public"."Moderator"
  ADD COLUMN IF NOT EXISTS "termsAccepted" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "termsAcceptedAt" TIMESTAMP(3);

ALTER TABLE "public"."TalentEvaluator"
  ADD COLUMN IF NOT EXISTS "termsAccepted" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "termsAcceptedAt" TIMESTAMP(3);

ALTER TABLE "public"."AppUser"
  ADD COLUMN IF NOT EXISTS "termsAccepted" BOOLEAN NOT NULL DEFAULT false;
