-- CreateTable: Student (was missing from the database)
CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "olympiadCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "password" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Student.olympiadCode must be unique (one student per ID)
CREATE UNIQUE INDEX "Student_olympiadCode_key" ON "Student"("olympiadCode");

-- AddForeignKey: Student → OlympiadIdAllocation (cascade delete)
ALTER TABLE "Student" ADD CONSTRAINT "Student_olympiadCode_fkey"
    FOREIGN KEY ("olympiadCode") REFERENCES "OlympiadIdAllocation"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddColumn: sentAt on OlympiadIdAllocation (tracks when the ID was sent to student)
ALTER TABLE "OlympiadIdAllocation" ADD COLUMN IF NOT EXISTS "sentAt" TIMESTAMP(3);
