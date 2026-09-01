-- Request-based linkage between an app user and a registered school.
--
-- Until now a school could only reach a student through an Olympiad ID:
--   School -> OlympiadIdAllocation.code -> AppUser.olympiadId -> Video.appUserId
-- A student of the school who never sat the Olympiad has no allocation row, so
-- that chain can never reach them and they are invisible to their own school.
-- SchoolLinkRequest is the second path: the student asks from the app, the
-- school approves from its portal, and from then on their videos resolve as
-- that school's videos (see src/lib/schoolMembers.ts).
--
-- Approval grants nothing else — no Olympiad ID, no Olympiad entry, no
-- permissions, and no change to any video.
--
-- MUST be applied BEFORE deploying the matching code: /api/app/my-school and
-- /api/school/me/student-requests query this table directly, and both school
-- video feeds now resolve membership through it. Without it those endpoints
-- throw and return 500.
--
-- Purely additive: one new table plus one nullable column. Nothing existing is
-- modified, and every statement is idempotent.

-- Free-text school name for a user whose school is not on Mittmee. A profile
-- label only: it creates no linkage and surfaces no video on any portal.
ALTER TABLE "public"."AppUser"
  ADD COLUMN IF NOT EXISTS "unlistedSchoolName" TEXT;

CREATE TABLE IF NOT EXISTS "public"."SchoolLinkRequest" (
    "id"        TEXT NOT NULL,
    "appUserId" TEXT NOT NULL,
    "schoolId"  TEXT NOT NULL,
    "status"    TEXT NOT NULL DEFAULT 'PENDING',   -- PENDING | APPROVED | REJECTED
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "SchoolLinkRequest_pkey" PRIMARY KEY ("id")
);

-- One row per (user, school): a rejected student re-asking the same school
-- flips this row back to PENDING instead of stacking duplicate history.
CREATE UNIQUE INDEX IF NOT EXISTS "SchoolLinkRequest_appUserId_schoolId_key"
  ON "public"."SchoolLinkRequest"("appUserId", "schoolId");

-- Serves the app's "what is my school?" lookup.
CREATE INDEX IF NOT EXISTS "SchoolLinkRequest_appUserId_status_idx"
  ON "public"."SchoolLinkRequest"("appUserId", "status");

-- Serves the portal's pending-requests list and the school video feeds.
CREATE INDEX IF NOT EXISTS "SchoolLinkRequest_schoolId_status_idx"
  ON "public"."SchoolLinkRequest"("schoolId", "status");

-- Cascade on both sides: a deleted user or school leaves no dangling link.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SchoolLinkRequest_appUserId_fkey'
  ) THEN
    ALTER TABLE "public"."SchoolLinkRequest"
      ADD CONSTRAINT "SchoolLinkRequest_appUserId_fkey"
      FOREIGN KEY ("appUserId") REFERENCES "public"."AppUser"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SchoolLinkRequest_schoolId_fkey'
  ) THEN
    ALTER TABLE "public"."SchoolLinkRequest"
      ADD CONSTRAINT "SchoolLinkRequest_schoolId_fkey"
      FOREIGN KEY ("schoolId") REFERENCES "public"."School"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
