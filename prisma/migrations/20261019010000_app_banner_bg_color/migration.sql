-- Additive: optional per-slide band colour for the festive top of the app
-- home screen. Existing slides get '' (= use the theme's band colour).
-- Safe to re-run.

ALTER TABLE "public"."AppBannerSlide" ADD COLUMN IF NOT EXISTS "bgColor" TEXT NOT NULL DEFAULT '';
