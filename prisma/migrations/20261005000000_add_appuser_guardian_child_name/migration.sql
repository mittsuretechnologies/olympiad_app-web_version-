-- Purely additive: two new nullable columns on AppUser, no existing data touched.
-- Filled by the app's sign-up screen (Parent/Guardian name required there,
-- child's name optional); accounts created before this stay NULL.
ALTER TABLE "public"."AppUser" ADD COLUMN IF NOT EXISTS "guardianName" TEXT;
ALTER TABLE "public"."AppUser" ADD COLUMN IF NOT EXISTS "childName" TEXT;
