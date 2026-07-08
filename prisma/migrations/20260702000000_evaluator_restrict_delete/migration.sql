-- DropForeignKey
ALTER TABLE "VideoEvaluation" DROP CONSTRAINT "VideoEvaluation_evaluatorId_fkey";

-- AddForeignKey
ALTER TABLE "VideoEvaluation" ADD CONSTRAINT "VideoEvaluation_evaluatorId_fkey" FOREIGN KEY ("evaluatorId") REFERENCES "TalentEvaluator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
