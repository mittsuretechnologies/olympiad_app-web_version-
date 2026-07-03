-- AlterTable: Video — soft delete so admin/superadmin retain full record + uploader details
ALTER TABLE "public"."Video"
    ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Video_deletedAt_idx" ON "public"."Video"("deletedAt");
