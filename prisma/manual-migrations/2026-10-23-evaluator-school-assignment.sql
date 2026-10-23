-- Evaluator -> School assignment (replaces the state/district scoping).
--
-- Additive only: creates one NEW table. Nothing existing is changed or
-- deleted ("TalentEvaluator"."assignedStates"/"assignedDistricts" stay as
-- unused legacy columns). Safe to re-run.
--
-- AFTER running: evaluators with no assigned school see an EMPTY queue until
-- an admin assigns schools in Evaluator -> Assign Schools.

CREATE TABLE IF NOT EXISTS "public"."EvaluatorSchool" (
    "id" TEXT NOT NULL,
    "evaluatorId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "assignedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvaluatorSchool_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "EvaluatorSchool_evaluatorId_fkey" FOREIGN KEY ("evaluatorId") REFERENCES "public"."TalentEvaluator"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EvaluatorSchool_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "public"."School"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "EvaluatorSchool_evaluatorId_schoolId_key" ON "public"."EvaluatorSchool"("evaluatorId", "schoolId");
CREATE INDEX IF NOT EXISTS "EvaluatorSchool_schoolId_idx" ON "public"."EvaluatorSchool"("schoolId");
