-- Legal acceptance records for versioned agreements (first: the School
-- Onboarding Agreement shown on a school's first login to the School Panel).
--
-- Purely additive: one new table, nothing existing is altered or touched.
-- No foreign key to School on purpose — the acceptance record is legal
-- evidence and must survive even if the school row is later removed.
--
-- Run this BEFORE deploying the code: the School Panel gate reads this table
-- and will keep schools on the agreement screen (with a retry) if it's missing.

CREATE TABLE IF NOT EXISTS "public"."AgreementAcceptance" (
    "id"                   TEXT         NOT NULL,
    "role"                 TEXT         NOT NULL,
    "actorId"              TEXT         NOT NULL,
    "actorCode"            TEXT,
    "actorName"            TEXT         NOT NULL,
    "documentKey"          TEXT         NOT NULL,
    "documentVersion"      TEXT         NOT NULL,
    "documentHash"         TEXT         NOT NULL,
    "signatoryName"        TEXT         NOT NULL,
    "signatoryDesignation" TEXT         NOT NULL,
    "signatoryPhone"       TEXT,
    "details"              JSONB        NOT NULL,
    "declarations"         JSONB        NOT NULL,
    "verificationChannel"  TEXT         NOT NULL,
    "verificationTarget"   TEXT,
    "verifiedAt"           TIMESTAMP(3) NOT NULL,
    "ipAddress"            TEXT,
    "userAgent"            TEXT,
    "readStartedAt"        TIMESTAMP(3),
    "readCompletedAt"      TIMESTAMP(3),
    "acceptedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "emailCopyTo"          TEXT,
    "emailCopySentAt"      TIMESTAMP(3),
    "revokedAt"            TIMESTAMP(3),
    "revokedBy"            TEXT,
    "revokeReason"         TEXT,

    CONSTRAINT "AgreementAcceptance_pkey" PRIMARY KEY ("id")
);

-- Not unique: a SuperAdmin can ask a school to accept again, which revokes the
-- old row (kept as evidence) and lets a new one be recorded for the same version.
CREATE INDEX IF NOT EXISTS "AgreementAcceptance_actor_doc_version_idx"
    ON "public"."AgreementAcceptance"("role", "actorId", "documentKey", "documentVersion");

CREATE INDEX IF NOT EXISTS "AgreementAcceptance_role_doc_version_idx"
    ON "public"."AgreementAcceptance"("role", "documentKey", "documentVersion");

CREATE INDEX IF NOT EXISTS "AgreementAcceptance_acceptedAt_idx"
    ON "public"."AgreementAcceptance"("acceptedAt");
