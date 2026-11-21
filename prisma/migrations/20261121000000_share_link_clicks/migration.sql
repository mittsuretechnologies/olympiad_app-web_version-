-- Additive: one new table, nothing existing changes. Safe to re-run.
-- Shared-video link taps in a browser, so a freshly installed app can open
-- the video that brought the person in (deferred deep link).

CREATE TABLE IF NOT EXISTS "public"."ShareLinkClick" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimedAt" TIMESTAMP(3),

    CONSTRAINT "ShareLinkClick_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ShareLinkClick_ip_createdAt_idx" ON "public"."ShareLinkClick"("ip", "createdAt");
