-- CreateTable: VideoReport
CREATE TABLE "public"."VideoReport" (
    "id"           TEXT NOT NULL,
    "videoId"      TEXT NOT NULL,
    "reporterId"   TEXT NOT NULL,
    "ownerId"      TEXT,
    "category"     TEXT NOT NULL,
    "customReason" TEXT,
    "resolved"     BOOLEAN NOT NULL DEFAULT false,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VideoReport_pkey" PRIMARY KEY ("id")
);

-- Duplicate-report protection: one report per user per video
CREATE UNIQUE INDEX "VideoReport_videoId_reporterId_key" ON "public"."VideoReport"("videoId", "reporterId");

-- Indexes
CREATE INDEX "VideoReport_videoId_idx"    ON "public"."VideoReport"("videoId");
CREATE INDEX "VideoReport_reporterId_idx" ON "public"."VideoReport"("reporterId");

-- Foreign keys
ALTER TABLE "public"."VideoReport" ADD CONSTRAINT "VideoReport_videoId_fkey"
    FOREIGN KEY ("videoId")    REFERENCES "public"."Video"("id")   ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."VideoReport" ADD CONSTRAINT "VideoReport_reporterId_fkey"
    FOREIGN KEY ("reporterId") REFERENCES "public"."AppUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: AppSetting (generic key/value config, e.g. REPORT_THRESHOLD)
CREATE TABLE "public"."AppSetting" (
    "key"       TEXT NOT NULL,
    "value"     TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);
