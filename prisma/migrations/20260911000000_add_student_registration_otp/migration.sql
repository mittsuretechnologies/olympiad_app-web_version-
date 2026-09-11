-- CreateTable
CREATE TABLE IF NOT EXISTS "public"."StudentRegistrationOtp" (
    "id" TEXT NOT NULL,
    "olympiadCode" TEXT NOT NULL,
    "otpHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentRegistrationOtp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "StudentRegistrationOtp_olympiadCode_key" ON "public"."StudentRegistrationOtp"("olympiadCode");
