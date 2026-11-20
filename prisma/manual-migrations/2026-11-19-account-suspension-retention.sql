-- Account suspend / ban, 180-day retention and inactivity erasure
-- (commit 40a27d2, PR #111). That commit changed schema.prisma but shipped no
-- SQL, so the code asks for columns the database does not have, e.g.
--   "The column `AppUser.deletionAgreedAt` does not exist in the current database."
--
-- ADDITIVE ONLY: new nullable columns and one new table. No existing column,
-- row or table is changed or removed. Every statement uses IF NOT EXISTS, so
-- it is safe to re-run, and safe if part of it was already applied by hand.
--
-- Also re-guards the two migrations from the same PR (PushToken table,
-- Video.isInfluencer), in case they were never applied to this database —
-- if they were, those statements do nothing.
--
-- Run with:  npx prisma db execute --file prisma/manual-migrations/2026-11-19-account-suspension-retention.sql --schema prisma/schema.prisma
-- NEVER `prisma db push` / `npm run db:sync`: the databases have tables that are
-- not in schema.prisma, and db push would drop them.

-- ── AppUser: suspend / ban, delete-dialog agreement, inactivity notice ───────
ALTER TABLE "public"."AppUser" ADD COLUMN IF NOT EXISTS "deletionAgreedAt"   TIMESTAMP(3);
ALTER TABLE "public"."AppUser" ADD COLUMN IF NOT EXISTS "inactivityNoticeAt" TIMESTAMP(3);
ALTER TABLE "public"."AppUser" ADD COLUMN IF NOT EXISTS "suspendedAt"        TIMESTAMP(3);
ALTER TABLE "public"."AppUser" ADD COLUMN IF NOT EXISTS "suspendedUntil"     TIMESTAMP(3);
ALTER TABLE "public"."AppUser" ADD COLUMN IF NOT EXISTS "suspensionType"     TEXT;
ALTER TABLE "public"."AppUser" ADD COLUMN IF NOT EXISTS "suspensionReason"   TEXT;

-- ── AccountDeletionRequest: when the user ticked "I agree" ───────────────────
ALTER TABLE "public"."AccountDeletionRequest" ADD COLUMN IF NOT EXISTS "agreedAt" TIMESTAMP(3);

-- ── DeletedAccountArchive: 180-day record of a permanently deleted account ───
CREATE TABLE IF NOT EXISTS "public"."DeletedAccountArchive" (
    "id"        TEXT NOT NULL,
    "appUserId" TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "reason"    TEXT NOT NULL,
    "snapshot"  JSONB NOT NULL,
    "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "purgeAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeletedAccountArchive_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "DeletedAccountArchive_purgeAt_idx" ON "public"."DeletedAccountArchive"("purgeAt");
CREATE INDEX IF NOT EXISTS "DeletedAccountArchive_userId_idx"  ON "public"."DeletedAccountArchive"("userId");

-- ── Same PR: Video influencer pick (prisma/migrations/20261116000000) ────────
ALTER TABLE "public"."Video" ADD COLUMN IF NOT EXISTS "isInfluencer" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "public"."Video" ADD COLUMN IF NOT EXISTS "influencerAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "Video_isInfluencer_idx" ON "public"."Video"("isInfluencer");

-- ── Same PR: push notification tokens (prisma/migrations/20261114000000) ─────
CREATE TABLE IF NOT EXISTS "public"."PushToken" (
    "id"        TEXT NOT NULL,
    "token"     TEXT NOT NULL,
    "appUserId" TEXT NOT NULL,
    "platform"  TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushToken_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PushToken_token_key"     ON "public"."PushToken"("token");
CREATE INDEX        IF NOT EXISTS "PushToken_appUserId_idx" ON "public"."PushToken"("appUserId");
DO $$ BEGIN
  ALTER TABLE "public"."PushToken"
    ADD CONSTRAINT "PushToken_appUserId_fkey" FOREIGN KEY ("appUserId")
    REFERENCES "public"."AppUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
