-- AlterTable: SupportTicket — add type, adminResponse, respondedAt, isReadByUser
ALTER TABLE "public"."SupportTicket" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'TECHNICAL';
ALTER TABLE "public"."SupportTicket" ADD COLUMN "adminResponse" TEXT;
ALTER TABLE "public"."SupportTicket" ADD COLUMN "respondedAt" TIMESTAMP(3);
ALTER TABLE "public"."SupportTicket" ADD COLUMN "isReadByUser" BOOLEAN NOT NULL DEFAULT true;
