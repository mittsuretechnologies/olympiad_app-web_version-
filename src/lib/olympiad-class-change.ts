import { prisma } from '@/lib/prisma';
import { CLASSES } from '@/lib/classes';
import { recordAuditLog } from '@/lib/audit-log';

// Correcting the class of an Olympiad ID (e.g. a school handed LKG children UKG
// IDs and the other way round). The ID itself never changes — login, videos,
// exam and passport all hang off the code — only classCode / className do, so
// the class letter inside the code may no longer match the class. Nothing
// parses that letter; the class is always read from these two columns.
//
// A school may change it only while nothing has been judged on it yet:
//   - its passports have not been released to it, and
//   - none of this student's Olympiad videos has been evaluated.
// After that only SuperAdmin / MasterAdmin can (Schools → Olympiad IDs).
// Every change is written to the audit log with the old and new class.

/** Why the school can't change this ID's class any more, or null when it can. */
export async function schoolClassChangeLock(code: string, schoolDbId: string): Promise<string | null> {
  const released = await prisma.passportRelease.findUnique({ where: { schoolId: schoolDbId }, select: { id: true } }).catch(() => null);
  if (released) return 'Passports have already been released to your school. Contact admin to change the class.';

  const [students, appUsers] = await Promise.all([
    prisma.student.findMany({ where: { olympiadCode: code }, select: { id: true } }),
    prisma.appUser.findMany({ where: { olympiadId: code }, select: { id: true } }),
  ]);
  const owners = [
    ...students.map(s => ({ studentId: s.id })),
    ...appUsers.map(u => ({ appUserId: u.id })),
  ];
  if (owners.length) {
    const evaluated = await prisma.videoEvaluation.count({ where: { video: { OR: owners } } });
    if (evaluated > 0) return "This student's video has already been evaluated. Contact admin to change the class.";
  }
  return null;
}

export type ClassChangeResult =
  | { ok: true; classCode: string; className: string }
  | { ok: false; status: number; message: string };

/**
 * Sets the ID's class. `asSchool` (School.id) checks that the ID is that
 * school's and applies the school lock above; leave it unset for an admin.
 */
export async function changeOlympiadIdClass(
  code: string,
  newClassName: string,
  actor: { id: string; role: string; name?: string | null },
  opts: { asSchool?: string; schoolDbId?: string } = {},
): Promise<ClassChangeResult> {
  const cls = CLASSES.find(c => c.name === newClassName);
  if (!cls) return { ok: false, status: 400, message: `Invalid class: ${newClassName || '(empty)'}` };

  const alloc = await prisma.olympiadIdAllocation.findUnique({
    where: { code },
    select: { id: true, schoolId: true, classCode: true, className: true },
  });
  const ownerSchool = opts.asSchool ?? opts.schoolDbId;
  if (!alloc || (ownerSchool && alloc.schoolId !== ownerSchool)) {
    return { ok: false, status: 404, message: 'Olympiad ID not found' };
  }
  if (alloc.classCode === cls.code && alloc.className === cls.name) {
    return { ok: true, classCode: cls.code, className: cls.name };
  }
  if (opts.asSchool) {
    const lock = await schoolClassChangeLock(code, opts.asSchool);
    if (lock) return { ok: false, status: 409, message: lock };
  }

  await prisma.olympiadIdAllocation.update({
    where: { code },
    data: { classCode: cls.code, className: cls.name },
  });
  await recordAuditLog({
    actorId: actor.id,
    actorRole: actor.role,
    actorName: actor.name ?? null,
    action: 'OLYMPIAD_ID_CLASS_CHANGED',
    entityType: 'OlympiadIdAllocation',
    entityId: alloc.id,
    previousValue: { code, classCode: alloc.classCode, className: alloc.className },
    newValue: { code, classCode: cls.code, className: cls.name },
  });
  return { ok: true, classCode: cls.code, className: cls.name };
}
