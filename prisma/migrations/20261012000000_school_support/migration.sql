-- School Panel Help & Support: tickets raised by schools and the message
-- thread on each. Purely additive — two new tables, nothing existing changes.
--
-- Safe to run more than once: every step checks before it creates, and the
-- ticket-number sequence is never moved backwards.

CREATE TABLE IF NOT EXISTS "public"."SchoolSupportTicket" (
    "id"             TEXT         NOT NULL,
    "ticketNo"       SERIAL       NOT NULL,
    "schoolId"       TEXT         NOT NULL,
    "category"       TEXT         NOT NULL,
    "subject"        TEXT         NOT NULL,
    "priority"       TEXT         NOT NULL DEFAULT 'NORMAL',
    "status"         TEXT         NOT NULL DEFAULT 'OPEN',
    "contactName"    TEXT,
    "contactPhone"   TEXT,
    "unreadBySchool" BOOLEAN      NOT NULL DEFAULT false,
    "unreadByTeam"   BOOLEAN      NOT NULL DEFAULT true,
    "lastMessageAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt"     TIMESTAMP(3),
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SchoolSupportTicket_pkey" PRIMARY KEY ("id")
);

-- Reference numbers start at HS-1001 rather than HS-1. setval to the larger of
-- 1000 and the highest number already used, so a re-run never rewinds it.
SELECT setval(
  pg_get_serial_sequence('"public"."SchoolSupportTicket"', 'ticketNo'),
  GREATEST(1000, COALESCE((SELECT MAX("ticketNo") FROM "public"."SchoolSupportTicket"), 0))
);

CREATE UNIQUE INDEX IF NOT EXISTS "SchoolSupportTicket_ticketNo_key" ON "public"."SchoolSupportTicket"("ticketNo");
CREATE INDEX IF NOT EXISTS "SchoolSupportTicket_schoolId_status_idx" ON "public"."SchoolSupportTicket"("schoolId", "status");
CREATE INDEX IF NOT EXISTS "SchoolSupportTicket_status_lastMessageAt_idx" ON "public"."SchoolSupportTicket"("status", "lastMessageAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SchoolSupportTicket_schoolId_fkey') THEN
    ALTER TABLE "public"."SchoolSupportTicket"
      ADD CONSTRAINT "SchoolSupportTicket_schoolId_fkey"
      FOREIGN KEY ("schoolId") REFERENCES "public"."School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "public"."SchoolSupportMessage" (
    "id"          TEXT         NOT NULL,
    "ticketId"    TEXT         NOT NULL,
    "kind"        TEXT         NOT NULL DEFAULT 'MESSAGE',
    "authorRole"  TEXT         NOT NULL,
    "authorId"    TEXT         NOT NULL,
    "authorName"  TEXT,
    "body"        TEXT         NOT NULL,
    "attachments" JSONB,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SchoolSupportMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SchoolSupportMessage_ticketId_createdAt_idx" ON "public"."SchoolSupportMessage"("ticketId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SchoolSupportMessage_ticketId_fkey') THEN
    ALTER TABLE "public"."SchoolSupportMessage"
      ADD CONSTRAINT "SchoolSupportMessage_ticketId_fkey"
      FOREIGN KEY ("ticketId") REFERENCES "public"."SchoolSupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
