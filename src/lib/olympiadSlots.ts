import { prisma } from '@/lib/prisma';
import {
  OLYMPIAD_CAT_A_SUBS,
  OLYMPIAD_CAT_B_SUBS,
  OLYMPIAD_CAT_A_LABEL,
  OLYMPIAD_CAT_B_LABEL,
  SCHOOL_ROUND_VIDEOS,
} from '@/lib/olympiad-categories';

/**
 * The Olympiad "slots" of one student: category A (Talent Performance) and
 * category B (Rhymes / Speech), one video each.
 *
 * This is the single definition of the rule. The student's own upload
 * (/api/app/olympiad-video-slots, /api/app/videos), the school's upload on the
 * web and the school's upload in the app all have to agree, so they all use it.
 *
 * A slot is USED when a non-rejected, non-deleted video sits in it, or when any
 * video ever put in it has evaluation marks (marks lock a slot for good, even if
 * the video is later removed). A slot with only a rejected video is REJECTED:
 * free to upload again.
 */

export type OlympiadSlot = 'A' | 'B';

type SlotVideo = {
  category: string | null;
  subCategory: string | null;
  status: string;
  deletedAt: Date | null;
  evaluations: { id: string }[];
};

/** Which slot a category/sub-category belongs to, or null if it is not an Olympiad category. */
export function olympiadSlotOf(category: string | null | undefined, subCategory?: string | null): OlympiadSlot | null {
  if (category === OLYMPIAD_CAT_A_LABEL || category === 'Cat A') return 'A';
  if (category === OLYMPIAD_CAT_B_LABEL || category === 'Cat B') return 'B';
  const sub = subCategory ?? '';
  if (OLYMPIAD_CAT_A_SUBS.includes(sub)) return 'A';
  if (OLYMPIAD_CAT_B_SUBS.includes(sub)) return 'B';
  return null;
}

export function computeOlympiadSlots(videos: SlotVideo[]) {
  const isA = (v: SlotVideo) => olympiadSlotOf(v.category, v.subCategory) === 'A';
  const isB = (v: SlotVideo) => olympiadSlotOf(v.category, v.subCategory) === 'B';
  const active = videos.filter(v => v.deletedAt === null && v.status !== 'REJECTED');

  const lockedA = videos.some(v => isA(v) && v.evaluations.length > 0);
  const lockedB = videos.some(v => isB(v) && v.evaluations.length > 0);
  const usedA = lockedA || active.some(isA);
  const usedB = lockedB || active.some(isB);
  const rejectedA = !usedA && videos.some(v => v.deletedAt === null && v.status === 'REJECTED' && isA(v));
  const rejectedB = !usedB && videos.some(v => v.deletedAt === null && v.status === 'REJECTED' && isB(v));
  const approvedCount = videos.filter(v => v.deletedAt === null && v.status === 'APPROVED').length;

  return { slotA: usedA, slotB: usedB, lockedA, lockedB, rejectedA, rejectedB, approvedCount };
}

export type SchoolStudent = {
  /** Student.id when the student was registered on the web, else null */
  studentRowId: string | null;
  /** AppUser.id when the student has an app account, else null */
  appUserId: string | null;
  olympiadCode: string;
  name: string;
  classCode: string | null;
  className: string | null;
};

/**
 * Finds one of THIS school's students from the id the school app/web uses (a
 * Student.id or an AppUser.id) - or null when it is not found or belongs to
 * another school. One student can exist both as a web Student and as an app
 * account under the same Olympiad ID; both are returned so their videos are
 * counted together.
 */
export async function resolveSchoolStudent(schoolId: string, studentId: string): Promise<SchoolStudent | null> {
  const webStudent = await prisma.student.findFirst({
    where: { id: studentId },
    select: { id: true, name: true, olympiadCode: true },
  });

  let code: string | null = webStudent?.olympiadCode ?? null;
  let appUser: { id: string } | null = null;
  if (!webStudent) {
    const au = await prisma.appUser.findFirst({
      where: { id: studentId },
      select: { id: true, olympiadId: true },
    });
    if (!au?.olympiadId) return null;
    code = au.olympiadId;
    appUser = { id: au.id };
  }
  if (!code) return null;

  const allocation = await prisma.olympiadIdAllocation.findUnique({
    where: { code },
    select: { schoolId: true, classCode: true, className: true, assignedName: true },
  });
  if (!allocation || allocation.schoolId !== schoolId) return null;

  const [otherAppUser, otherStudent] = await Promise.all([
    appUser ? Promise.resolve(appUser) : prisma.appUser.findFirst({ where: { olympiadId: code }, select: { id: true } }),
    webStudent ? Promise.resolve(webStudent) : prisma.student.findFirst({ where: { olympiadCode: code }, select: { id: true, name: true } }),
  ]);

  return {
    studentRowId: otherStudent?.id ?? null,
    appUserId: otherAppUser?.id ?? null,
    olympiadCode: code,
    name: allocation.assignedName || otherStudent?.name || code,
    classCode: allocation.classCode,
    className: allocation.className,
  };
}

/** The student's slots, from every Olympiad video of theirs whoever uploaded it. */
export async function slotsForStudent(student: SchoolStudent) {
  const owners: object[] = [];
  if (student.studentRowId) owners.push({ studentId: student.studentRowId });
  if (student.appUserId) owners.push({ appUserId: student.appUserId });
  if (owners.length === 0) return computeOlympiadSlots([]);

  // No deletedAt filter: an evaluated video keeps locking its slot even after it
  // is removed, so soft-deleted rows must be seen too (computeOlympiadSlots
  // ignores them for everything else).
  const videos = await prisma.video.findMany({
    where: { OR: owners, isEvaluation: true, ...SCHOOL_ROUND_VIDEOS },
    select: { category: true, subCategory: true, status: true, deletedAt: true, evaluations: { select: { id: true } } },
  });
  return computeOlympiadSlots(videos);
}
