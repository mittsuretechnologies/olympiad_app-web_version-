import { prisma } from '@/lib/prisma';
import { VIDEO_MAX_SCORE } from '@/lib/kosh';
import { STATE_CATEGORY } from '@/lib/olympiad-categories';

// How many distinct state holistic percentages make the national pool, and how
// many of those are the national winners.
export const STATE_TOP_N = 10;
export const NATIONAL_TOP_N = 3;

// The state score is out of 100: 50 for the video and 50 for the online
// interview. The interview does not exist yet, so for now statePercent is the
// video's marks out of its own 50. Once it exists, statePercent = video + interview.
export const STATE_VIDEO_MARKS = 50;
export const STATE_INTERVIEW_MARKS = 50;

export type StateVideoStatus = 'NOT_SUBMITTED' | 'IN_MODERATION' | 'REJECTED' | 'IN_EVALUATION' | 'SCORED';

export interface StateStudent {
  olympiadCode: string;
  name: string;
  className: string | null;
  schoolName: string | null;
  schoolCode: string | null;
  district: string | null;
  state: string | null;
  schoolPercent: number; // the school-round holistic % they were forwarded on
  videoStatus: StateVideoStatus;
  videoMarks: number | null;
  statePercent: number | null;
  rank: number | null; // 1 = highest distinct percentage; null = outside the national pool
}

export interface NationalTier {
  rank: number;
  statePercent: number;
  students: StateStudent[];
}

// Whether this Olympiad ID has been forwarded to the state level. Tolerates the
// DistrictForward table not existing yet: nobody is qualified until it does.
export async function isStateQualified(olympiadCode: string) {
  try {
    return !!(await prisma.districtForward.findUnique({ where: { olympiadCode }, select: { id: true } }));
  } catch (err) {
    console.warn('state-round: DistrictForward unavailable', err);
    return false;
  }
}

// The student's one state-round slot, across their app and web records. Same rule
// as the A/B slots: marks lock it for good, a live non-rejected video fills it, and
// a slot holding only a rejected video is free to upload again.
export async function stateSlotOf(owner: { appUserId?: string | null; studentId?: string | null }) {
  const owners: object[] = [];
  if (owner.appUserId) owners.push({ appUserId: owner.appUserId });
  if (owner.studentId) owners.push({ studentId: owner.studentId });
  if (owners.length === 0) return { used: false, locked: false, rejected: false };

  const videos = await prisma.video.findMany({
    where: { OR: owners, isEvaluation: true, category: STATE_CATEGORY },
    select: { status: true, deletedAt: true, evaluations: { select: { id: true } } },
  });
  const locked = videos.some(v => v.evaluations.length > 0);
  const used = locked || videos.some(v => v.deletedAt === null && v.status !== 'REJECTED');
  const rejected = !used && videos.some(v => v.deletedAt === null && v.status === 'REJECTED');
  return { used, locked, rejected };
}

// Everyone forwarded to the state level with their state-round video score, then
// the national pool (top STATE_TOP_N distinct state percentages) and the winners
// (top NATIONAL_TOP_N of those). A tie puts several students on one tier. Computed
// live from published evaluations only; nothing is stored.
export async function rankStateRound() {
  const forwards = await prisma.districtForward.findMany({ select: { olympiadCode: true, holisticPercent: true } });
  const codes = forwards.map(f => f.olympiadCode);

  const [allocations, webStudents, appUsers] = await Promise.all([
    prisma.olympiadIdAllocation.findMany({
      where: { code: { in: codes } },
      select: {
        code: true, classCode: true, className: true, assignedName: true,
        school: { select: { schoolId: true, name: true, state: true, district: true } },
      },
    }),
    prisma.student.findMany({ where: { olympiadCode: { in: codes } }, select: { id: true, name: true, olympiadCode: true } }),
    prisma.appUser.findMany({ where: { olympiadId: { in: codes } }, select: { id: true, userId: true, olympiadId: true } }),
  ]);
  const allocByCode = new Map(allocations.map(a => [a.code, a]));
  const webByCode = new Map(webStudents.map(s => [s.olympiadCode, s]));
  const appByCode = new Map(appUsers.map(u => [u.olympiadId as string, u]));

  // One student can exist as both a web Student and an app account.
  const codeByOwner = new Map<string, string>();
  for (const s of webStudents) codeByOwner.set(s.id, s.olympiadCode);
  for (const u of appUsers) codeByOwner.set(u.id, u.olympiadId as string);

  const videos = await prisma.video.findMany({
    where: {
      isEvaluation: true, category: STATE_CATEGORY, deletedAt: null,
      OR: [{ studentId: { in: webStudents.map(s => s.id) } }, { appUserId: { in: appUsers.map(u => u.id) } }],
    },
    select: { studentId: true, appUserId: true, status: true, evaluations: { select: { totalScore: true, isPublished: true } } },
    orderBy: { createdAt: 'asc' },
  });
  const videosByCode = new Map<string, typeof videos>();
  for (const v of videos) {
    const code = (v.studentId && codeByOwner.get(v.studentId)) || (v.appUserId && codeByOwner.get(v.appUserId));
    if (!code) continue;
    (videosByCode.get(code) || videosByCode.set(code, []).get(code)!).push(v);
  }

  const students: StateStudent[] = forwards.map(f => {
    const list = videosByCode.get(f.olympiadCode) ?? [];
    const scored = list.find(v => v.status === 'APPROVED' && v.evaluations[0]?.isPublished);
    const total = scored?.evaluations[0]?.totalScore ?? null;
    const videoStatus: StateVideoStatus = scored ? 'SCORED'
      : list.some(v => v.status === 'APPROVED') ? 'IN_EVALUATION'
      : list.some(v => v.status === 'PENDING') ? 'IN_MODERATION'
      : list.length ? 'REJECTED' : 'NOT_SUBMITTED';
    const alloc = allocByCode.get(f.olympiadCode);
    return {
      olympiadCode: f.olympiadCode,
      name: alloc?.assignedName || webByCode.get(f.olympiadCode)?.name || appByCode.get(f.olympiadCode)?.userId || f.olympiadCode,
      className: alloc?.className || alloc?.classCode || null,
      schoolName: alloc?.school?.name ?? null,
      schoolCode: alloc?.school?.schoolId ?? null,
      district: alloc?.school?.district ?? null,
      state: alloc?.school?.state ?? null,
      schoolPercent: f.holisticPercent,
      videoStatus,
      videoMarks: total === null ? null : Math.round((total / VIDEO_MAX_SCORE) * STATE_VIDEO_MARKS * 10) / 10,
      statePercent: total === null ? null : Math.round((total / VIDEO_MAX_SCORE) * 1000) / 10,
      rank: null,
    };
  });

  const topPercents = Array.from(new Set(students.flatMap(s => (s.statePercent === null ? [] : [s.statePercent]))))
    .sort((a, b) => b - a)
    .slice(0, STATE_TOP_N);
  const rankOf = new Map(topPercents.map((p, i) => [p, i + 1]));
  for (const s of students) s.rank = s.statePercent === null ? null : rankOf.get(s.statePercent) ?? null;

  students.sort((a, b) => (b.statePercent ?? -1) - (a.statePercent ?? -1) || a.name.localeCompare(b.name));

  const winners: NationalTier[] = topPercents.slice(0, NATIONAL_TOP_N).map((p, i) => ({
    rank: i + 1,
    statePercent: p,
    students: students.filter(s => s.statePercent === p),
  }));

  return { students, topPercents, winners };
}
