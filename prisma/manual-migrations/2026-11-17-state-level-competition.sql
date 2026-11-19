-- State Level competition (Result → State Level → State Toppers → National Winners).
--
-- Additive only: two nullable columns on DistrictForward and one on Video, plus
-- an index. Nothing is dropped, renamed or rewritten; existing rows keep their
-- values (the new columns start NULL).
--
--  DistrictForward.examSource    'manual' | 'ai': the exam marks (Result page
--                                toggle) the student's stage-1 result was
--                                taken from when they were forwarded.
--  DistrictForward.koshPercents  the stage-1 final % of each of the 5 koshas at
--                                that moment, e.g. {"ANNAMAYA": 73.8, ...}. The
--                                State Level result combines these 50-50 with
--                                the State video, so later edits to stage-1
--                                marks don't move a forwarded student's score.
--  Video.competitionStage        NULL for every existing video. 'STATE' marks a
--                                State Level video, kept apart from the two
--                                Olympiad videos (isEvaluation) so it never
--                                counts in the stage-1 result.
--
-- Run with:  npx prisma db execute --file prisma/manual-migrations/2026-11-17-state-level-competition.sql --schema prisma/schema.prisma
-- NEVER `prisma db push` / `npm run db:sync`: the databases have tables that are
-- not in schema.prisma, and db push would drop them.
--
-- Safe to run more than once.

ALTER TABLE "public"."DistrictForward" ADD COLUMN IF NOT EXISTS "examSource" TEXT;
ALTER TABLE "public"."DistrictForward" ADD COLUMN IF NOT EXISTS "koshPercents" JSONB;

ALTER TABLE "public"."Video" ADD COLUMN IF NOT EXISTS "competitionStage" TEXT;
CREATE INDEX IF NOT EXISTS "Video_competitionStage_idx" ON "public"."Video"("competitionStage");
