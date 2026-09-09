-- Purely additive: new nullable column on AppUser, no existing data touched.
ALTER TABLE "public"."AppUser" ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP(3);
