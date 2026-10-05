-- CreateTable: InfringementNotice
CREATE TABLE "public"."InfringementNotice" (
    "id"           TEXT NOT NULL,
    "referenceId"  TEXT NOT NULL,
    "role"         TEXT NOT NULL,
    "fullName"     TEXT NOT NULL,
    "organisation" TEXT,
    "email"        TEXT NOT NULL,
    "phone"        TEXT NOT NULL,
    "videoLink"    TEXT NOT NULL,
    "rightTypes"   TEXT NOT NULL,
    "workTypes"    TEXT NOT NULL,
    "noticeText"   TEXT NOT NULL,
    "files"        JSONB NOT NULL,
    "emailSent"    BOOLEAN NOT NULL DEFAULT false,
    "status"       TEXT NOT NULL DEFAULT 'PENDING',
    "adminNotes"   TEXT,
    "resolvedAt"   TIMESTAMP(3),
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InfringementNotice_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "InfringementNotice_referenceId_key" ON "public"."InfringementNotice"("referenceId");
CREATE INDEX "InfringementNotice_status_idx" ON "public"."InfringementNotice"("status");
