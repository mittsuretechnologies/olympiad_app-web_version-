-- StudentRegistrationOtp — pending OTPs for web student self-registration.
--
-- Shipped in code (src/lib/otpStore.ts, used by /api/student/register and
-- /api/student/verify-otp) without a matching migration file; found by
-- diffing prisma/schema.prisma against the live database during the
-- 2026-09-11 deploy. Without this table both endpoints return 500.
--
-- Purely additive and idempotent: one new table, no existing data touched.
-- One row per olympiadCode (upsert replaces a pending OTP rather than
-- stacking duplicates), hence the unique index.

CREATE TABLE IF NOT EXISTS "public"."StudentRegistrationOtp" (
    "id"           TEXT NOT NULL,
    "olympiadCode" TEXT NOT NULL,
    "otpHash"      TEXT NOT NULL,
    "name"         TEXT NOT NULL,
    "phone"        TEXT NOT NULL,
    "attempts"     INTEGER NOT NULL DEFAULT 0,
    "expiresAt"    TIMESTAMP(3) NOT NULL,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentRegistrationOtp_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "StudentRegistrationOtp_olympiadCode_key"
  ON "public"."StudentRegistrationOtp"("olympiadCode");
