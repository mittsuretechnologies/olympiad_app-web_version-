-- State Toppers and National Winners, as frozen by SuperAdmin
-- (Result → State & National → Freeze).
--
-- Additive only: one new table and its indexes. Nothing existing is touched.
--
-- One row per student on a frozen list:
--   level  'STATE'    — a state's top 3 distinct State Holistic %s
--          'NATIONAL' — the top 3 distinct State Holistic %s across all states
-- Freezing a level replaces that level's rows with the live list at that
-- moment; un-freezing removes them. The live list keeps updating either way.
--
-- Run with:  npx prisma db execute --file prisma/manual-migrations/2026-11-17-competition-winners.sql --schema prisma/schema.prisma
-- NEVER `prisma db push` / `npm run db:sync`: the databases have tables that are
-- not in schema.prisma, and db push would drop them.
--
-- Safe to run more than once.

CREATE TABLE IF NOT EXISTS "public"."CompetitionWinner" (
  "id"                    TEXT NOT NULL,
  "level"                 TEXT NOT NULL,
  "rank"                  INTEGER NOT NULL,
  "olympiadCode"          TEXT NOT NULL,
  "name"                  TEXT NOT NULL,
  "className"             TEXT,
  "schoolName"            TEXT,
  "schoolCode"            TEXT,
  "district"              TEXT,
  "state"                 TEXT,
  "stateHolisticPercent"  DOUBLE PRECISION NOT NULL,
  "stage1HolisticPercent" DOUBLE PRECISION,
  "koshPercents"          JSONB,
  "frozenAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "frozenBy"              TEXT,
  CONSTRAINT "CompetitionWinner_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CompetitionWinner_level_olympiadCode_key" ON "public"."CompetitionWinner"("level", "olympiadCode");
CREATE INDEX IF NOT EXISTS "CompetitionWinner_level_idx" ON "public"."CompetitionWinner"("level");
