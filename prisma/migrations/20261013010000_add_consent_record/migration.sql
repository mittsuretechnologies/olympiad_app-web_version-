-- Additive: new ConsentRecord table (see schema.prisma / src/lib/consent.ts).
-- Nothing existing is changed. Safe to re-run — each step is guarded.

CREATE TABLE IF NOT EXISTS "public"."ConsentRecord" (
    "id"                  TEXT         NOT NULL,
    "appUserId"           TEXT         NOT NULL,
    "userHandle"          TEXT         NOT NULL,
    "consentedByName"     TEXT,
    "documentKey"         TEXT         NOT NULL,
    "documentVersion"     TEXT         NOT NULL,
    "documentUrl"         TEXT,
    "method"              TEXT         NOT NULL,
    "verificationChannel" TEXT,
    "verificationTarget"  TEXT,
    "ipAddress"           TEXT,
    "userAgent"           TEXT,
    "consentedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "withdrawnAt"         TIMESTAMP(3),
    "withdrawnById"       TEXT,
    "withdrawnByName"     TEXT,
    "withdrawalReason"    TEXT,
    CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ConsentRecord_appUserId_documentKey_idx"       ON "public"."ConsentRecord"("appUserId", "documentKey");
CREATE INDEX IF NOT EXISTS "ConsentRecord_documentKey_documentVersion_idx" ON "public"."ConsentRecord"("documentKey", "documentVersion");
CREATE INDEX IF NOT EXISTS "ConsentRecord_consentedAt_idx"                 ON "public"."ConsentRecord"("consentedAt");

-- Backfill: every account that already accepted gets one TERMS_OF_USE row
-- from termsAcceptedAt. The version shown at the time was never stored, so it
-- is recorded as UNRECORDED rather than guessed. Skipped for accounts that
-- already have a row, so re-running adds nothing.
INSERT INTO "public"."ConsentRecord"
  ("id", "appUserId", "userHandle", "consentedByName", "documentKey", "documentVersion",
   "documentUrl", "method", "consentedAt")
SELECT gen_random_uuid()::text, u."id", u."userId", u."guardianName", 'TERMS_OF_USE', 'UNRECORDED',
       'https://www.mittmee.com/terms-of-use', 'LEGACY_BACKFILL', COALESCE(u."termsAcceptedAt", u."createdAt")
FROM "public"."AppUser" u
WHERE u."termsAccepted" = true
  AND NOT EXISTS (SELECT 1 FROM "public"."ConsentRecord" c WHERE c."appUserId" = u."id");
