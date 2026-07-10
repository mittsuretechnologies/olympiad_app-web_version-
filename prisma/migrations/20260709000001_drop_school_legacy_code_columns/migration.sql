-- DropColumn: School.districtCode, School.stateCode
-- These were superseded by School.district / School.state and are unreferenced in app code.
ALTER TABLE "public"."School" DROP COLUMN IF EXISTS "districtCode";
ALTER TABLE "public"."School" DROP COLUMN IF EXISTS "stateCode";
