import { prisma } from '@/lib/prisma';
import { KOSH_CRITERIA, KOSH_KEYS, KOSH_LABELS, MAX_PER_CRITERION, type KoshKey } from '@/lib/kosh';
import { getResultOverview, type ExamSource } from '@/lib/result-overview';
import { STATE_STAGE } from '@/lib/stateCompetition';
import { areaKey } from '@/lib/district-forward';

/**
 * State Level result → State Toppers → National Winners.
 *
 * Who: every student forwarded to the State Level (DistrictForward — each
 * district's top 10 distinct stage-1 holistic %s, lib/district-forward.ts).
 *
 * Per kosha:   final % = (stage-1 % + State video %) ÷ 2
 *   stage-1 %       the student's final kosha % (exam + both Olympiad videos),
 *                   saved when they were forwarded (DistrictForward.koshPercents)
 *   State video %   that kosha's criterion on their State Level video, out of 4,
 *                   once the evaluation is PUBLISHED
 *   A side that isn't there yet counts as 0, the same rule as the stage-1
 *   result: no State video (or no published marks) means 0 on that side.
 * State Holistic % = the average of the 5 final kosha %s.
 *
 * State Toppers:    per state, the top STATE_TOP_N distinct State Holistic %s
 *                   and everyone on them (ties share a rank).
 * Each state's Rank 1 on the frozen list goes on to the National Level, which
 * is scored separately (lib/national-result.ts).
 */

export const STATE_TOP_N = 10;
/** CompetitionWinner.level values: 'STATE' here, 'NATIONAL' in lib/national-result.ts. */
export const WINNER_LEVELS = ['STATE', 'NATIONAL'] as const;
export type WinnerLevel = (typeof WINNER_LEVELS)[number];

const round1 = (n: number) => Math.round(n * 10) / 10;

export interface StateKosh {
  kosh: KoshKey;
  label: string;
  stage1Percent: number | null;
  stateVideoPercent: number | null;
  finalPercent: number;
}

export interface StateCompetitorResult {
  olympiadCode: string;
  name: string;
  className: string | null;
  schoolName: string | null;
  schoolCode: string | null;
  district: string | null;
  state: string | null;
  forwardedAt: Date;
  examSource: ExamSource;
  stage1HolisticPercent: number;
  video: {
    id: string; status: string; subCategory: string | null;
    evaluated: boolean; published: boolean; totalScore: number | null;
  } | null;
  /** NO_VIDEO, AWAITING_MARKS (uploaded, marks not published yet) or SCORED. */
  progress: 'NO_VIDEO' | 'AWAITING_MARKS' | 'SCORED';
  kosh: StateKosh[];
  stateHolisticPercent: number;
}

export async function stateLevelResults(): Promise<StateCompetitorResult[]> {
  const forwards = await prisma.districtForward.findMany({
    select: {
      olympiadCode: true, holisticPercent: true, examSource: true, koshPercents: true, forwardedAt: true,
      school: { select: { schoolId: true, name: true, district: true, state: true } },
    },
  });
  if (forwards.length === 0) return [];
  const codes = forwards.map(f => f.olympiadCode);

  const [allocations, webStudents, appUsers] = await Promise.all([
    prisma.olympiadIdAllocation.findMany({
      where: { code: { in: codes } },
      select: { code: true, assignedName: true, className: true, classCode: true },
    }),
    prisma.student.findMany({ where: { olympiadCode: { in: codes } }, select: { olympiadCode: true, name: true } }),
    prisma.appUser.findMany({ where: { olympiadId: { in: codes } }, select: { id: true, userId: true, olympiadId: true } }),
  ]);
  const allocByCode = new Map(allocations.map(a => [a.code, a]));
  const studentByCode = new Map(webStudents.map(s => [s.olympiadCode, s]));
  const appUserByCode = new Map(appUsers.map(u => [u.olympiadId!, u]));

  // State Level videos of the competitors' app accounts (removed ones left out).
  const videos = appUsers.length
    ? await prisma.video.findMany({
        where: { competitionStage: STATE_STAGE, appUserId: { in: appUsers.map(u => u.id) }, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, appUserId: true, status: true, subCategory: true,
          evaluations: {
            select: {
              coordinationScore: true, memoryEnergyScore: true, imaginationEmotionScore: true,
              focusLanguageScore: true, creativityJoyScore: true, totalScore: true, isPublished: true,
            },
          },
        },
      })
    : [];
  // One per competitor: the scored one if any, else the newest that isn't rejected, else the newest.
  const videoByUser = new Map<string, (typeof videos)[number]>();
  for (const v of videos) {
    const prev = videoByUser.get(v.appUserId!);
    const score = (x: typeof v) => (x.evaluations.some(e => e.isPublished) ? 3 : x.evaluations.length ? 2 : x.status !== 'REJECTED' ? 1 : 0);
    if (!prev || score(v) > score(prev)) videoByUser.set(v.appUserId!, v);
  }

  // Forwarded before kosha %s were saved: take them from the live stage-1 result.
  const missing = forwards.filter(f => !f.koshPercents || typeof f.koshPercents !== 'object');
  const liveKosh = new Map<string, Partial<Record<KoshKey, number>>>();
  for (const src of ['manual', 'ai'] as const) {
    const need = missing.filter(f => (f.examSource === 'ai' ? 'ai' : 'manual') === src);
    if (!need.length) continue;
    const overview = await getResultOverview('', src);
    const wanted = new Set(need.map(f => f.olympiadCode));
    for (const r of overview?.rows ?? []) {
      if (!wanted.has(r.olympiadCode)) continue;
      liveKosh.set(r.olympiadCode, Object.fromEntries(
        r.koshBreakdown.filter(k => k.combinedPercent !== null).map(k => [k.kosh, k.combinedPercent as number]),
      ));
    }
  }

  return forwards.map(f => {
    const alloc = allocByCode.get(f.olympiadCode);
    const appUser = appUserByCode.get(f.olympiadCode);
    const stage1 = (f.koshPercents && typeof f.koshPercents === 'object'
      ? f.koshPercents as Partial<Record<KoshKey, number>>
      : liveKosh.get(f.olympiadCode)) ?? {};

    const v = appUser ? videoByUser.get(appUser.id) : undefined;
    const published = v?.evaluations.find(e => e.isPublished) ?? null;

    const kosh: StateKosh[] = KOSH_KEYS.map(k => {
      const criterion = KOSH_CRITERIA.find(c => c.kosh === k)!;
      const stage1Percent = typeof stage1[k] === 'number' ? stage1[k]! : null;
      const stateVideoPercent = published ? round1((published[criterion.key] / MAX_PER_CRITERION) * 100) : null;
      return {
        kosh: k,
        label: KOSH_LABELS[k],
        stage1Percent,
        stateVideoPercent,
        finalPercent: round1(((stage1Percent ?? 0) + (stateVideoPercent ?? 0)) / 2),
      };
    });

    return {
      olympiadCode: f.olympiadCode,
      name: alloc?.assignedName || studentByCode.get(f.olympiadCode)?.name || appUser?.userId || f.olympiadCode,
      className: alloc?.className || alloc?.classCode || null,
      schoolName: f.school?.name ?? null,
      schoolCode: f.school?.schoolId ?? null,
      district: f.school?.district?.trim() || null,
      state: f.school?.state?.trim() || null,
      forwardedAt: f.forwardedAt,
      examSource: f.examSource === 'ai' ? 'ai' : 'manual',
      stage1HolisticPercent: f.holisticPercent,
      video: v ? {
        id: v.id, status: v.status, subCategory: v.subCategory,
        evaluated: v.evaluations.length > 0, published: !!published, totalScore: published?.totalScore ?? null,
      } : null,
      progress: !v || v.status === 'REJECTED' ? 'NO_VIDEO' : published ? 'SCORED' : 'AWAITING_MARKS',
      kosh,
      stateHolisticPercent: round1(kosh.reduce((s, k) => s + k.finalPercent, 0) / kosh.length),
    } satisfies StateCompetitorResult;
  }).sort((a, b) => b.stateHolisticPercent - a.stateHolisticPercent || a.name.localeCompare(b.name));
}

export interface WinnerTier { rank: number; stateHolisticPercent: number; students: StateCompetitorResult[] }

/** The top `n` distinct State Holistic %s and everyone on each. */
export function topTiers(list: StateCompetitorResult[], n: number): WinnerTier[] {
  const percents = Array.from(new Set(list.map(r => r.stateHolisticPercent))).sort((a, b) => b - a).slice(0, n);
  return percents.map((p, i) => ({
    rank: i + 1,
    stateHolisticPercent: p,
    students: list.filter(r => r.stateHolisticPercent === p),
  }));
}

/** State Toppers per state. Competitors whose school has no state set are left out (and counted). */
export function stateToppers(results: StateCompetitorResult[]) {
  // Grouped case/space-insensitively ("Rajasthan" and "rajasthan " are one state).
  const byState = new Map<string, StateCompetitorResult[]>();
  let noState = 0;
  for (const r of results) {
    const key = areaKey(r.state);
    if (!key) { noState++; continue; }
    (byState.get(key) || byState.set(key, []).get(key)!).push(r);
  }
  const states = Array.from(byState.values())
    .map(list => ({ state: list[0].state!, competitors: list.length, tiers: topTiers(list, STATE_TOP_N) }))
    .sort((a, b) => a.state.localeCompare(b.state));
  return { states, noState };
}

/** The rows a freeze of the State Toppers saves. */
export function winnerRows(level: 'STATE', results: StateCompetitorResult[], frozenBy: string | null) {
  const tiers = stateToppers(results).states.flatMap(s => s.tiers);
  return tiers.flatMap(t => t.students.map(r => ({
    level,
    rank: t.rank,
    olympiadCode: r.olympiadCode,
    name: r.name,
    className: r.className,
    schoolName: r.schoolName,
    schoolCode: r.schoolCode,
    district: r.district,
    state: r.state,
    stateHolisticPercent: r.stateHolisticPercent,
    stage1HolisticPercent: r.stage1HolisticPercent,
    koshPercents: Object.fromEntries(r.kosh.map(k => [k.kosh, k.finalPercent])),
    frozenBy,
  })));
}
