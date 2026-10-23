import { prisma } from '@/lib/prisma';

// An evaluator only sees videos from the schools assigned to them (see
// EvaluatorSchool, managed in Evaluator -> Assign Schools). No assigned
// schools = no videos.
export async function assignedSchoolIds(evaluatorId: string): Promise<string[]> {
  const rows = await prisma.evaluatorSchool.findMany({
    where: { evaluatorId },
    select: { schoolId: true },
  });
  return rows.map(r => r.schoolId);
}

// True if this evaluator may score the given video: the video owner's school
// (via Student or AppUser -> Olympiad ID allocation) must be one of theirs.
export async function evaluatorCanAccessVideo(evaluatorId: string, video: { studentId: string | null; appUserId: string | null }): Promise<boolean> {
  let schoolId: string | null = null;

  if (video.studentId) {
    const student = await prisma.student.findUnique({
      where: { id: video.studentId },
      select: { allocation: { select: { schoolId: true } } },
    });
    schoolId = student?.allocation?.schoolId ?? null;
  } else if (video.appUserId) {
    const appUser = await prisma.appUser.findUnique({
      where: { id: video.appUserId },
      select: { olympiadId: true },
    });
    if (appUser?.olympiadId) {
      const allocation = await prisma.olympiadIdAllocation.findUnique({
        where: { code: appUser.olympiadId },
        select: { schoolId: true },
      });
      schoolId = allocation?.schoolId ?? null;
    }
  }

  if (!schoolId) return false;
  const link = await prisma.evaluatorSchool.findUnique({
    where: { evaluatorId_schoolId: { evaluatorId, schoolId } },
    select: { id: true },
  });
  return !!link;
}
