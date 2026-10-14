-- Move video 3a2cebd0-6df8-455b-894e-8020b4e0582d ("Jan gan man🙏", Talent
-- Performance / Singing) from APPROVED back to PENDING so it re-enters the
-- moderation queue. Approved 2026-10-12 06:41 UTC by Mittsure Admin; it is not
-- a jury (isEvaluation) video and has no evaluations.
--
-- quality is cleared because it is only set at approval time — pending videos
-- carry NULL, and the moderator picks it again on the next approve.
--
-- Guarded on status = 'APPROVED' and no evaluations: if anything changed since
-- this was written, the UPDATE touches 0 rows and the audit row is skipped too.

BEGIN;

WITH moved AS (
  UPDATE "Video"
  SET status            = 'PENDING',
      quality           = NULL,
      "rejectionReason" = NULL,
      "claimedById"     = NULL,
      "claimedByName"   = NULL,
      "claimedAt"       = NULL,
      "updatedAt"       = NOW()
  WHERE id = '3a2cebd0-6df8-455b-894e-8020b4e0582d'
    AND status = 'APPROVED'
    AND "deletedAt" IS NULL
    AND NOT EXISTS (SELECT 1 FROM "VideoEvaluation" e WHERE e."videoId" = "Video".id)
  RETURNING id
)
INSERT INTO "AuditLog" (id, "actorId", "actorRole", "actorName", action, "entityType", "entityId", "previousValue", "newValue", reason, "createdAt")
SELECT gen_random_uuid()::text, 'manual-sql', 'SUPERADMIN', 'Manual SQL fix', 'VIDEO_MOVED_TO_PENDING', 'Video', id,
       '{"status":"APPROVED","quality":"MEDIUM"}',
       '{"status":"PENDING","quality":null}',
       'Approval reverted to pending on request',
       NOW()
FROM moved;

-- Expect: status = PENDING, quality = NULL
SELECT id, status, quality, "updatedAt" FROM "Video" WHERE id = '3a2cebd0-6df8-455b-894e-8020b4e0582d';

COMMIT;
