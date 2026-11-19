-- National Level (Level 3): State Rank 1 → Virtual Assessment + National video
-- → Top 3 National. See lib/national-result.ts.
--
-- Additive only: one NEW table and one nullable column on CompetitionWinner.
-- Nothing is dropped, renamed or rewritten; existing rows keep their values
-- (the new column starts NULL).
--
--  NationalForward                    one row per student forwarded to the
--                                     National Level (their state's Rank 1 on
--                                     the frozen State Toppers list), with
--                                     snapshots of their Level 1 % and State
--                                     video %, and the Virtual Assessment
--                                     marks SuperAdmin types in.
--  CompetitionWinner.nationalPercent  NATIONAL rows only: the National % that
--                                     ranked them.
--
-- Video.competitionStage gets a new value 'NATIONAL' (the National video);
-- that is data, not a schema change.
--
-- Run with:  npx prisma db execute --file prisma/manual-migrations/2026-11-18-national-level.sql --schema prisma/schema.prisma
-- NEVER `prisma db push` / `npm run db:sync`: the databases have tables that are
-- not in schema.prisma, and db push would drop them.
--
-- Safe to run more than once.

CREATE TABLE IF NOT EXISTS "public"."NationalForward" (
  "id"                   TEXT NOT NULL,
  "olympiadCode"         TEXT NOT NULL,
  "name"                 TEXT NOT NULL,
  "className"            TEXT,
  "schoolName"           TEXT,
  "schoolCode"           TEXT,
  "district"             TEXT,
  "state"                TEXT,
  "stage1Percent"        DOUBLE PRECISION NOT NULL,
  "stateVideoPercent"    DOUBLE PRECISION NOT NULL,
  "stateHolisticPercent" DOUBLE PRECISION NOT NULL,
  "assessmentScore"      DOUBLE PRECISION,
  "assessmentMax"        DOUBLE PRECISION,
  "assessmentBy"         TEXT,
  "assessmentAt"         TIMESTAMP(3),
  "forwardedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "forwardedBy"          TEXT,
  CONSTRAINT "NationalForward_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "NationalForward_olympiadCode_key" ON "public"."NationalForward"("olympiadCode");

ALTER TABLE "public"."CompetitionWinner" ADD COLUMN IF NOT EXISTS "nationalPercent" DOUBLE PRECISION;
