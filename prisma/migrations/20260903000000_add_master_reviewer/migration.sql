-- CreateTable
CREATE TABLE IF NOT EXISTS "public"."MasterReviewer" (
    "id" TEXT NOT NULL,
    "masterReviewerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "plainPassword" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MasterReviewer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "MasterReviewer_masterReviewerId_key" ON "public"."MasterReviewer"("masterReviewerId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "MasterReviewer_email_key" ON "public"."MasterReviewer"("email");
