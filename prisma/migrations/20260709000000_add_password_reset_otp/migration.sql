-- CreateTable: PasswordResetOtp
CREATE TABLE "public"."PasswordResetOtp" (
    "id"         TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "otpHash"    TEXT NOT NULL,
    "attempts"   INTEGER NOT NULL DEFAULT 0,
    "lastSentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt"  TIMESTAMP(3) NOT NULL,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetOtp_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "PasswordResetOtp_identifier_key" ON "public"."PasswordResetOtp"("identifier");
