-- CreateTable
CREATE TABLE "VideoEvaluation" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "evaluatorId" TEXT NOT NULL,
    "confidenceScore" INTEGER NOT NULL,
    "creativityScore" INTEGER NOT NULL,
    "techniqueScore" INTEGER NOT NULL,
    "presentationScore" INTEGER NOT NULL,
    "overallScore" INTEGER NOT NULL,
    "totalScore" INTEGER NOT NULL,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VideoEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VideoEvaluation_videoId_key" ON "VideoEvaluation"("videoId");

-- CreateIndex
CREATE INDEX "VideoEvaluation_evaluatorId_idx" ON "VideoEvaluation"("evaluatorId");

-- AddForeignKey
ALTER TABLE "VideoEvaluation" ADD CONSTRAINT "VideoEvaluation_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoEvaluation" ADD CONSTRAINT "VideoEvaluation_evaluatorId_fkey" FOREIGN KEY ("evaluatorId") REFERENCES "TalentEvaluator"("id") ON DELETE CASCADE ON UPDATE CASCADE;
