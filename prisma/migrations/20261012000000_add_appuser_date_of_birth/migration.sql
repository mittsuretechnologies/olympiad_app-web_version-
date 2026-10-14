-- Purely additive: nullable date column on AppUser. Existing accounts stay NULL.
ALTER TABLE "public"."AppUser" ADD COLUMN IF NOT EXISTS "dateOfBirth" DATE;
