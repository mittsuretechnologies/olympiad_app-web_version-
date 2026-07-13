import { prisma } from '@/lib/prisma';

// Returns true if this evaluator is allowed to score the given video, based on
// their assignedStates (state codes, e.g. ["RJ"]). Empty array = unrestricted.
// Looks up the video's owner's school state code via Student or AppUser.
export async function evaluatorCanAccessVideo(evaluatorId: string, video: { studentId: string | null; appUserId: string | null }): Promise<boolean> {
  const evaluator = await prisma.talentEvaluator.findUnique({
    where: { id: evaluatorId },
    select: { assignedStates: true },
  });
  if (!evaluator) return false;
  if (evaluator.assignedStates.length === 0) return true;

  let stateCode: string | null = null;

  if (video.studentId) {
    const student = await prisma.student.findUnique({
      where: { id: video.studentId },
      select: { allocation: { select: { school: { select: { stateCode: true } } } } },
    });
    stateCode = student?.allocation?.school?.stateCode ?? null;
  } else if (video.appUserId) {
    const appUser = await prisma.appUser.findUnique({
      where: { id: video.appUserId },
      select: { olympiadId: true },
    });
    if (appUser?.olympiadId) {
      const allocation = await prisma.olympiadIdAllocation.findUnique({
        where: { code: appUser.olympiadId },
        select: { school: { select: { stateCode: true } } },
      });
      stateCode = allocation?.school?.stateCode ?? null;
    }
  }

  return !!stateCode && evaluator.assignedStates.includes(stateCode);
}
