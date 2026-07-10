ALTER TABLE "public"."TalentEvaluator" ADD COLUMN IF NOT EXISTS "assignedDistricts" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "public"."TalentEvaluator" ADD COLUMN IF NOT EXISTS "assignedStates" TEXT[] DEFAULT ARRAY[]::TEXT[];
