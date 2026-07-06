-- AlterTable: AppUser — permanent record of Olympiad category approval, survives video deletion
ALTER TABLE "public"."AppUser"
    ADD COLUMN IF NOT EXISTS "olympiadCatAApproved" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "olympiadCatBApproved" BOOLEAN NOT NULL DEFAULT false;
