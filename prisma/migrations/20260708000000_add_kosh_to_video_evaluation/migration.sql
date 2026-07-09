-- CreateEnum
CREATE TYPE "Kosh" AS ENUM ('ANNAMAYA', 'PRANAMAYA', 'VIJNANAMAYA', 'ANANDAMAYA');

-- AlterTable: kosh is nullable so pre-existing rows (scored before this
-- system existed) are left as-is; every row created going forward sets it.
ALTER TABLE "VideoEvaluation" ADD COLUMN "kosh" "Kosh";

-- DropIndex: old 1:1 constraint (one evaluation per video)
DROP INDEX "VideoEvaluation_videoId_key";

-- CreateIndex: new constraint allows 2 rows per video, one per kosh
CREATE UNIQUE INDEX "VideoEvaluation_videoId_kosh_key" ON "VideoEvaluation"("videoId", "kosh");
