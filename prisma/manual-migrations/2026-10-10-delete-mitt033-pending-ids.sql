-- Delete 13 unused (Pending) Olympiad IDs from school MITT033
-- (My Chhota School Chhidwada-Chhindwara, CRM S-28169):
--   S28169N00010 .. S28169N00013  (Nursery)
--   S28169L00014 .. S28169L00017  (LKG)
--   S28169U00018 .. S28169U00022  (UKG)
--
-- Scope: ONLY these 13 rows in "OlympiadIdAllocation". No other table or row
-- is modified. The transaction aborts (rolls back, nothing changes) if any of
-- these IDs is referenced anywhere — Student (would cascade to the student and
-- their videos), AppUser, Attendance, or StudentRegistrationOtp.
-- Run the PREVIEW first, then the whole transaction.

-- ---------- PREVIEW (read-only) ----------
SELECT a.code, a."className", a."sentAt", a."assignedName", s.id AS student_id
FROM "OlympiadIdAllocation" a
JOIN "School" sc ON sc.id = a."schoolId"
LEFT JOIN "Student" s ON s."olympiadCode" = a.code
WHERE sc."schoolId" = 'MITT033'
  AND a.code IN (
    'S28169N00010','S28169N00011','S28169N00012','S28169N00013',
    'S28169L00014','S28169L00015','S28169L00016','S28169L00017',
    'S28169U00018','S28169U00019','S28169U00020','S28169U00021','S28169U00022')
ORDER BY a.sequence;
-- Expect 13 rows, student_id all NULL.

-- ---------- DELETE ----------
BEGIN;

CREATE TEMP TABLE _target ON COMMIT DROP AS
SELECT a.id, a.code, a."schoolId"
FROM "OlympiadIdAllocation" a
JOIN "School" sc ON sc.id = a."schoolId"
WHERE sc."schoolId" = 'MITT033'
  AND a.code IN (
    'S28169N00010','S28169N00011','S28169N00012','S28169N00013',
    'S28169L00014','S28169L00015','S28169L00016','S28169L00017',
    'S28169U00018','S28169U00019','S28169U00020','S28169U00021','S28169U00022');

DO $$
BEGIN
  IF (SELECT count(*) FROM _target) <> 13 THEN
    RAISE EXCEPTION 'Expected 13 allocations, found %', (SELECT count(*) FROM _target);
  END IF;
  IF EXISTS (SELECT 1 FROM "Student" WHERE "olympiadCode" IN (SELECT code FROM _target)) THEN
    RAISE EXCEPTION 'Aborting: a Student is registered on one of these IDs';
  END IF;
  IF EXISTS (SELECT 1 FROM "AppUser" WHERE "olympiadId" IN (SELECT code FROM _target)) THEN
    RAISE EXCEPTION 'Aborting: an AppUser is linked to one of these IDs';
  END IF;
  IF EXISTS (SELECT 1 FROM "Attendance" WHERE "olympiadCode" IN (SELECT code FROM _target)) THEN
    RAISE EXCEPTION 'Aborting: Attendance rows exist for one of these IDs';
  END IF;
  IF EXISTS (SELECT 1 FROM "StudentRegistrationOtp" WHERE "olympiadCode" IN (SELECT code FROM _target)) THEN
    RAISE EXCEPTION 'Aborting: a registration OTP exists for one of these IDs';
  END IF;
END $$;

-- Only these 13 OlympiadIdAllocation rows are deleted — nothing else.
DELETE FROM "OlympiadIdAllocation" WHERE id IN (SELECT id FROM _target);
-- Expect: DELETE 13

COMMIT;
