-- Additive only: a moderator can mark a video as an influencer pick, which puts
-- it first in its category's row on the app home screen.
ALTER TABLE "public"."Video" ADD COLUMN "isInfluencer" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "influencerAt" TIMESTAMP(3);

CREATE INDEX "Video_isInfluencer_idx" ON "public"."Video"("isInfluencer");
