-- CreateTable: SupportTicket
CREATE TABLE "public"."SupportTicket" (
    "id"             TEXT NOT NULL,
    "userId"         TEXT NOT NULL,
    "category"       TEXT,
    "message"        TEXT NOT NULL,
    "screenshotUrls" TEXT,
    "status"         TEXT NOT NULL DEFAULT 'OPEN',
    "resolvedAt"     TIMESTAMP(3),
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "SupportTicket_userId_idx" ON "public"."SupportTicket"("userId");
CREATE INDEX "SupportTicket_status_idx" ON "public"."SupportTicket"("status");

-- Foreign keys
ALTER TABLE "public"."SupportTicket" ADD CONSTRAINT "SupportTicket_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "public"."AppUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
