import { prisma } from '@/lib/prisma';
import { recordAuditLog } from '@/lib/audit-log';

// Removing a wrong allotment (e.g. the school gave an LKG child a UKG ID).
// The ID goes back to Pending so the school can allot it again, and the app
// account that was made for it is NOT deleted: it is only unlinked from the ID
// (olympiadId → null), so its User ID and password keep working as an ordinary
// (general) app account. Nothing is deleted.
//
// Allowed only while nothing has happened on the ID yet — no Olympiad video,
// no attendance, no passport, not forwarded. After that the student's work is
// tied to this ID, so the school must contact admin instead.

/** Why this allotment can't be removed any more, or null when it can. */
export async function allotmentRemoveLock(code: string, schoolDbId: string): Promise<string | null> {
  const [schoolRelease, studentRelease, attendance, forwarded, appUsers] = await Promise.all([
    prisma.passportRelease.findUnique({ where: { schoolId: schoolDbId }, select: { id: true } }),
    prisma.studentPassportRelease.findUnique({ where: { olympiadCode: code }, select: { id: true } }),
    prisma.attendance.findUnique({ where: { schoolId_olympiadCode: { schoolId: schoolDbId, olympiadCode: code } }, select: { id: true } }),
    prisma.districtForward.findUnique({ where: { olympiadCode: code }, select: { id: true } }),
    prisma.appUser.findMany({ where: { olympiadId: code }, select: { id: true } }),
  ]);
  if (schoolRelease || studentRelease) return 'Passports have already been released. Contact admin.';
  if (attendance) return 'Attendance is already marked for this ID. Contact admin.';
  if (forwarded) return 'This student has already been forwarded in the result. Contact admin.';
  if (appUsers.length) {
    const videos = await prisma.video.count({
      where: { appUserId: { in: appUsers.map(u => u.id) }, isEvaluation: true, deletedAt: null },
    });
    if (videos > 0) return 'An Olympiad video has already been uploaded on this ID. Contact admin.';
  }
  return null;
}

export type RemoveAllotmentResult =
  | { ok: true; unlinkedUserId: string | null }
  | { ok: false; status: number; message: string };

export async function removeAllotment(
  code: string,
  schoolDbId: string,
  actor: { id: string; role: string; name?: string | null },
): Promise<RemoveAllotmentResult> {
  const alloc = await prisma.olympiadIdAllocation.findUnique({
    where: { code },
    select: { id: true, schoolId: true, assignedName: true, guardianName: true, assignedAt: true, student: { select: { id: true } } },
  });
  if (!alloc || alloc.schoolId !== schoolDbId) return { ok: false, status: 404, message: 'Olympiad ID not found' };
  if (alloc.student) return { ok: false, status: 409, message: 'This ID is registered on the website. Contact admin.' };

  const appUser = await prisma.appUser.findFirst({ where: { olympiadId: code }, select: { id: true, userId: true } });
  if (!alloc.assignedName && !appUser) return { ok: false, status: 409, message: 'This ID is not allotted' };

  const lock = await allotmentRemoveLock(code, schoolDbId);
  if (lock) return { ok: false, status: 409, message: lock };

  await prisma.$transaction([
    // Unlink only: the account stays and logs in as a general app account.
    ...(appUser
      ? [prisma.appUser.update({
          where: { id: appUser.id },
          data: { olympiadId: null, olympiadCatAApproved: false, olympiadCatBApproved: false },
        })]
      : []),
    prisma.olympiadIdAllocation.update({
      where: { code },
      data: { assignedName: null, guardianName: null, assignedAt: null },
    }),
  ]);

  await recordAuditLog({
    actorId: actor.id,
    actorRole: actor.role,
    actorName: actor.name ?? null,
    action: 'OLYMPIAD_ALLOTMENT_REMOVED',
    entityType: 'OlympiadIdAllocation',
    entityId: alloc.id,
    previousValue: {
      code,
      assignedName: alloc.assignedName,
      guardianName: alloc.guardianName,
      assignedAt: alloc.assignedAt,
      appUserId: appUser?.id ?? null,
      userId: appUser?.userId ?? null,
    },
    newValue: { code, assignedName: null, appUserUnlinked: !!appUser },
  });

  return { ok: true, unlinkedUserId: appUser?.userId ?? null };
}
