-- CreateTable
CREATE TABLE "OlympiadIdAllocation" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "schoolId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UNASSIGNED',
    "studentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OlympiadIdAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OlympiadIdAllocation_code_key" ON "OlympiadIdAllocation"("code");

-- CreateIndex
CREATE INDEX "OlympiadIdAllocation_schoolId_idx" ON "OlympiadIdAllocation"("schoolId");

-- AddForeignKey
ALTER TABLE "OlympiadIdAllocation" ADD CONSTRAINT "OlympiadIdAllocation_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
