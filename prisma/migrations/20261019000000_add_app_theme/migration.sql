-- Additive: new AppTheme table (festival themes for the mobile app home
-- screen) and an optional AppBannerSlide.themeId for festival-only carousel
-- slides. Nothing existing is changed — every current slide keeps
-- themeId = NULL, i.e. shown all year. Safe to re-run — each step is guarded.

CREATE TABLE IF NOT EXISTS "public"."AppTheme" (
    "id"        TEXT         NOT NULL,
    "name"      TEXT         NOT NULL,
    "isActive"  BOOLEAN      NOT NULL DEFAULT false,
    "startsAt"  TIMESTAMP(3),
    "endsAt"    TIMESTAMP(3),
    "priority"  INTEGER      NOT NULL DEFAULT 0,
    "config"    JSONB        NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AppTheme_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AppTheme_isActive_startsAt_endsAt_idx" ON "public"."AppTheme"("isActive", "startsAt", "endsAt");

ALTER TABLE "public"."AppBannerSlide" ADD COLUMN IF NOT EXISTS "themeId" TEXT;

CREATE INDEX IF NOT EXISTS "AppBannerSlide_themeId_idx" ON "public"."AppBannerSlide"("themeId");

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AppBannerSlide_themeId_fkey') THEN
        ALTER TABLE "public"."AppBannerSlide"
            ADD CONSTRAINT "AppBannerSlide_themeId_fkey"
            FOREIGN KEY ("themeId") REFERENCES "public"."AppTheme"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
