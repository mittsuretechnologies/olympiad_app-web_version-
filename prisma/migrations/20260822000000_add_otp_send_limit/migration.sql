-- Throttling state for OTP sends. Kept in its own table rather than on AppOtp:
-- AppOtp rows are deleted on successful verification, which would reset the
-- daily counter and let the cap be bypassed by verifying between requests.
CREATE TABLE IF NOT EXISTS "public"."OtpSendLimit" (
  "id"            TEXT NOT NULL,
  "identifier"    TEXT NOT NULL,
  "lastSentAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sendsToday"    INTEGER NOT NULL DEFAULT 0,
  "sendCountDate" TEXT NOT NULL DEFAULT '',
  CONSTRAINT "OtpSendLimit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "OtpSendLimit_identifier_key"
  ON "public"."OtpSendLimit"("identifier");
