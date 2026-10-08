-- Purely additive: lets the SuperAdmin pick Learning / Parenting videos to
-- show in the app's home carousel. Existing rows default to not shown.
ALTER TABLE "public"."HomeSectionVideo"
    ADD COLUMN IF NOT EXISTS "inCarousel" BOOLEAN NOT NULL DEFAULT false;
