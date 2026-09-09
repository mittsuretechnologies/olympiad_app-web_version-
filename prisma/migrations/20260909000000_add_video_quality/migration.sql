-- Purely additive: new nullable column on Video, no existing data touched.
ALTER TABLE "public"."Video" ADD COLUMN IF NOT EXISTS "quality" TEXT;
