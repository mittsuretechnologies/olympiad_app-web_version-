-- Request-based linkage between an app user and a registered school, for
-- students who have no Olympiad ID and therefore no OlympiadIdAllocation row.

-- AlterTable: free-text school name for users whose school is not registered.
-- Label only — it builds no linkage and surfaces no video anywhere.
ALTER TABLE "public"."AppUser" ADD COLUMN "unlistedSchoolName" TEXT;

-- CreateTable
CREATE TABLE "public"."SchoolLinkRequest" (
    "id"        TEXT NOT NULL,
    "appUserId" TEXT NOT NULL,
    "schoolId"  TEXT NOT NULL,
    "status"    TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "SchoolLinkRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SchoolLinkRequest_appUserId_schoolId_key" ON "public"."SchoolLinkRequest"("appUserId", "schoolId");
CREATE INDEX "SchoolLinkRequest_appUserId_status_idx" ON "public"."SchoolLinkRequest"("appUserId", "status");
CREATE INDEX "SchoolLinkRequest_schoolId_status_idx"  ON "public"."SchoolLinkRequest"("schoolId", "status");

-- AddForeignKey
ALTER TABLE "public"."SchoolLinkRequest" ADD CONSTRAINT "SchoolLinkRequest_appUserId_fkey" FOREIGN KEY ("appUserId") REFERENCES "public"."AppUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."SchoolLinkRequest" ADD CONSTRAINT "SchoolLinkRequest_schoolId_fkey"  FOREIGN KEY ("schoolId")  REFERENCES "public"."School"("id")  ON DELETE CASCADE ON UPDATE CASCADE;
