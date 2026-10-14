-- AlterTable: which school uploaded a video on a student's behalf
ALTER TABLE "public"."Video" ADD COLUMN "uploadedBySchoolId" TEXT;
