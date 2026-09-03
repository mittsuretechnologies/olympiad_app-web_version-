-- Purely additive migration: new nullable columns on School, and 9 brand-new
-- empty tables (Attendance, PaperDispatch/AnswerSheetDispatch families).
-- No DROP, no ALTER on existing data-bearing columns, nothing else touched.

-- AlterTable
ALTER TABLE "public"."School" ADD COLUMN     "attendanceSubmittedAt" TIMESTAMP(3),
ADD COLUMN     "examDate" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "public"."PaperDispatch" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL,
    "mode" TEXT,
    "trackingNo" TEXT,
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaperDispatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PaperDispatchClassCount" (
    "id" TEXT NOT NULL,
    "dispatchId" TEXT NOT NULL,
    "className" TEXT NOT NULL,
    "count" INTEGER NOT NULL,

    CONSTRAINT "PaperDispatchClassCount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PaperReceipt" (
    "id" TEXT NOT NULL,
    "dispatchId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "discrepancyNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaperReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PaperReceiptClassCount" (
    "id" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "className" TEXT NOT NULL,
    "count" INTEGER NOT NULL,

    CONSTRAINT "PaperReceiptClassCount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AnswerSheetDispatch" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL,
    "mode" TEXT,
    "trackingNo" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnswerSheetDispatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AnswerSheetDispatchClassCount" (
    "id" TEXT NOT NULL,
    "dispatchId" TEXT NOT NULL,
    "className" TEXT NOT NULL,
    "count" INTEGER NOT NULL,

    CONSTRAINT "AnswerSheetDispatchClassCount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AnswerSheetReceipt" (
    "id" TEXT NOT NULL,
    "dispatchId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "discrepancyNote" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnswerSheetReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AnswerSheetReceiptClassCount" (
    "id" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "className" TEXT NOT NULL,
    "count" INTEGER NOT NULL,

    CONSTRAINT "AnswerSheetReceiptClassCount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Attendance" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "olympiadCode" TEXT NOT NULL,
    "studentId" TEXT,
    "appUserId" TEXT,
    "status" TEXT NOT NULL,
    "markedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "markedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaperDispatch_schoolId_idx" ON "public"."PaperDispatch"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "PaperDispatchClassCount_dispatchId_className_key" ON "public"."PaperDispatchClassCount"("dispatchId", "className");

-- CreateIndex
CREATE UNIQUE INDEX "PaperReceipt_dispatchId_key" ON "public"."PaperReceipt"("dispatchId");

-- CreateIndex
CREATE INDEX "PaperReceipt_schoolId_idx" ON "public"."PaperReceipt"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "PaperReceiptClassCount_receiptId_className_key" ON "public"."PaperReceiptClassCount"("receiptId", "className");

-- CreateIndex
CREATE INDEX "AnswerSheetDispatch_schoolId_idx" ON "public"."AnswerSheetDispatch"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "AnswerSheetDispatchClassCount_dispatchId_className_key" ON "public"."AnswerSheetDispatchClassCount"("dispatchId", "className");

-- CreateIndex
CREATE UNIQUE INDEX "AnswerSheetReceipt_dispatchId_key" ON "public"."AnswerSheetReceipt"("dispatchId");

-- CreateIndex
CREATE INDEX "AnswerSheetReceipt_schoolId_idx" ON "public"."AnswerSheetReceipt"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "AnswerSheetReceiptClassCount_receiptId_className_key" ON "public"."AnswerSheetReceiptClassCount"("receiptId", "className");

-- CreateIndex
CREATE INDEX "Attendance_schoolId_idx" ON "public"."Attendance"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_schoolId_olympiadCode_key" ON "public"."Attendance"("schoolId", "olympiadCode");

-- AddForeignKey
ALTER TABLE "public"."PaperDispatch" ADD CONSTRAINT "PaperDispatch_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "public"."School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PaperDispatchClassCount" ADD CONSTRAINT "PaperDispatchClassCount_dispatchId_fkey" FOREIGN KEY ("dispatchId") REFERENCES "public"."PaperDispatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PaperReceipt" ADD CONSTRAINT "PaperReceipt_dispatchId_fkey" FOREIGN KEY ("dispatchId") REFERENCES "public"."PaperDispatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PaperReceiptClassCount" ADD CONSTRAINT "PaperReceiptClassCount_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "public"."PaperReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AnswerSheetDispatch" ADD CONSTRAINT "AnswerSheetDispatch_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "public"."School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AnswerSheetDispatchClassCount" ADD CONSTRAINT "AnswerSheetDispatchClassCount_dispatchId_fkey" FOREIGN KEY ("dispatchId") REFERENCES "public"."AnswerSheetDispatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AnswerSheetReceipt" ADD CONSTRAINT "AnswerSheetReceipt_dispatchId_fkey" FOREIGN KEY ("dispatchId") REFERENCES "public"."AnswerSheetDispatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AnswerSheetReceiptClassCount" ADD CONSTRAINT "AnswerSheetReceiptClassCount_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "public"."AnswerSheetReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Attendance" ADD CONSTRAINT "Attendance_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "public"."School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
