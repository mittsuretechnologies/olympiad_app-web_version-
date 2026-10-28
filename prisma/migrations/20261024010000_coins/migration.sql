-- Additive only: coins & rewards tables (CoinWalletV2, CoinTransactionV2, CoinTaskV2,
-- CoinRewardV2 sit beside the older Coin* tables, which are left untouched) plus two
-- nullable AppUser columns (referralCode, referredById).

-- AlterTable
ALTER TABLE "public"."AppUser" ADD COLUMN     "referralCode" TEXT,
ADD COLUMN     "referredById" TEXT;

-- CreateTable
CREATE TABLE "public"."CoinWalletV2" (
    "id" TEXT NOT NULL,
    "appUserId" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "lifetimeEarned" INTEGER NOT NULL DEFAULT 0,
    "lifetimeSpent" INTEGER NOT NULL DEFAULT 0,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "cycleDay" INTEGER NOT NULL DEFAULT 0,
    "cyclesCompleted" INTEGER NOT NULL DEFAULT 0,
    "lastCheckinDate" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoinWalletV2_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CoinTransactionV2" (
    "id" TEXT NOT NULL,
    "appUserId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "sourceType" TEXT,
    "sourceId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "inrPerCoin" DOUBLE PRECISION,
    "note" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoinTransactionV2_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CoinStreakDay" (
    "day" INTEGER NOT NULL,
    "coins" INTEGER NOT NULL,
    "isBonus" BOOLEAN NOT NULL DEFAULT false,
    "label" TEXT,

    CONSTRAINT "CoinStreakDay_pkey" PRIMARY KEY ("day")
);

-- CreateTable
CREATE TABLE "public"."CoinCheckin" (
    "id" TEXT NOT NULL,
    "appUserId" TEXT NOT NULL,
    "dateKey" TEXT NOT NULL,
    "cycleDay" INTEGER NOT NULL,
    "streak" INTEGER NOT NULL,
    "coins" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoinCheckin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CoinTaskV2" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "eventType" TEXT NOT NULL,
    "target" INTEGER NOT NULL DEFAULT 1,
    "coins" INTEGER NOT NULL,
    "frequency" TEXT NOT NULL DEFAULT 'DAILY',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoinTaskV2_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CoinTaskProgress" (
    "id" TEXT NOT NULL,
    "appUserId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "claimedAt" TIMESTAMP(3),

    CONSTRAINT "CoinTaskProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Referral" (
    "id" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "refereeId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "rejectReason" TEXT,
    "deviceId" TEXT,
    "ip" TEXT,
    "referrerCoins" INTEGER,
    "refereeCoins" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rewardedAt" TIMESTAMP(3),

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CoinRewardV2" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'COUPON',
    "costCoins" INTEGER NOT NULL,
    "stock" INTEGER,
    "perUserLimit" INTEGER NOT NULL DEFAULT 0,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "terms" TEXT,
    "instructions" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoinRewardV2_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CoinRewardCode" (
    "id" TEXT NOT NULL,
    "rewardId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "redemptionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoinRewardCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CoinRedemption" (
    "id" TEXT NOT NULL,
    "appUserId" TEXT NOT NULL,
    "rewardId" TEXT NOT NULL,
    "coinsSpent" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'FULFILLED',
    "code" TEXT,
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoinRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CoinGameRule" (
    "gameKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "maxPlaysPerDay" INTEGER NOT NULL DEFAULT 5,
    "maxCoinsPerDay" INTEGER NOT NULL DEFAULT 50,
    "minSeconds" INTEGER NOT NULL DEFAULT 0,
    "bands" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoinGameRule_pkey" PRIMARY KEY ("gameKey")
);

-- CreateIndex
CREATE UNIQUE INDEX "CoinWalletV2_appUserId_key" ON "public"."CoinWalletV2"("appUserId");

-- CreateIndex
CREATE UNIQUE INDEX "CoinTransactionV2_idempotencyKey_key" ON "public"."CoinTransactionV2"("idempotencyKey");

-- CreateIndex
CREATE INDEX "CoinTransactionV2_appUserId_createdAt_idx" ON "public"."CoinTransactionV2"("appUserId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "CoinTransactionV2_type_createdAt_idx" ON "public"."CoinTransactionV2"("type", "createdAt");

-- CreateIndex
CREATE INDEX "CoinTransactionV2_createdAt_idx" ON "public"."CoinTransactionV2"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CoinCheckin_appUserId_dateKey_key" ON "public"."CoinCheckin"("appUserId", "dateKey");

-- CreateIndex
CREATE INDEX "CoinTaskV2_active_eventType_idx" ON "public"."CoinTaskV2"("active", "eventType");

-- CreateIndex
CREATE INDEX "CoinTaskProgress_appUserId_periodKey_idx" ON "public"."CoinTaskProgress"("appUserId", "periodKey");

-- CreateIndex
CREATE UNIQUE INDEX "CoinTaskProgress_appUserId_taskId_periodKey_key" ON "public"."CoinTaskProgress"("appUserId", "taskId", "periodKey");

-- CreateIndex
CREATE UNIQUE INDEX "Referral_refereeId_key" ON "public"."Referral"("refereeId");

-- CreateIndex
CREATE INDEX "Referral_referrerId_status_idx" ON "public"."Referral"("referrerId", "status");

-- CreateIndex
CREATE INDEX "Referral_deviceId_idx" ON "public"."Referral"("deviceId");

-- CreateIndex
CREATE INDEX "Referral_status_createdAt_idx" ON "public"."Referral"("status", "createdAt");

-- CreateIndex
CREATE INDEX "CoinRewardV2_active_sortOrder_idx" ON "public"."CoinRewardV2"("active", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "CoinRewardCode_redemptionId_key" ON "public"."CoinRewardCode"("redemptionId");

-- CreateIndex
CREATE INDEX "CoinRewardCode_rewardId_redemptionId_idx" ON "public"."CoinRewardCode"("rewardId", "redemptionId");

-- CreateIndex
CREATE UNIQUE INDEX "CoinRewardCode_rewardId_code_key" ON "public"."CoinRewardCode"("rewardId", "code");

-- CreateIndex
CREATE INDEX "CoinRedemption_appUserId_createdAt_idx" ON "public"."CoinRedemption"("appUserId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "CoinRedemption_status_createdAt_idx" ON "public"."CoinRedemption"("status", "createdAt");

-- CreateIndex
CREATE INDEX "CoinRedemption_rewardId_idx" ON "public"."CoinRedemption"("rewardId");

-- CreateIndex
CREATE UNIQUE INDEX "AppUser_referralCode_key" ON "public"."AppUser"("referralCode");

-- AddForeignKey
ALTER TABLE "public"."CoinWalletV2" ADD CONSTRAINT "CoinWalletV2_appUserId_fkey" FOREIGN KEY ("appUserId") REFERENCES "public"."AppUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CoinTransactionV2" ADD CONSTRAINT "CoinTransactionV2_appUserId_fkey" FOREIGN KEY ("appUserId") REFERENCES "public"."AppUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CoinCheckin" ADD CONSTRAINT "CoinCheckin_appUserId_fkey" FOREIGN KEY ("appUserId") REFERENCES "public"."AppUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CoinTaskProgress" ADD CONSTRAINT "CoinTaskProgress_appUserId_fkey" FOREIGN KEY ("appUserId") REFERENCES "public"."AppUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CoinTaskProgress" ADD CONSTRAINT "CoinTaskProgress_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "public"."CoinTaskV2"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Referral" ADD CONSTRAINT "Referral_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "public"."AppUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Referral" ADD CONSTRAINT "Referral_refereeId_fkey" FOREIGN KEY ("refereeId") REFERENCES "public"."AppUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CoinRewardCode" ADD CONSTRAINT "CoinRewardCode_rewardId_fkey" FOREIGN KEY ("rewardId") REFERENCES "public"."CoinRewardV2"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CoinRedemption" ADD CONSTRAINT "CoinRedemption_appUserId_fkey" FOREIGN KEY ("appUserId") REFERENCES "public"."AppUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CoinRedemption" ADD CONSTRAINT "CoinRedemption_rewardId_fkey" FOREIGN KEY ("rewardId") REFERENCES "public"."CoinRewardV2"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

