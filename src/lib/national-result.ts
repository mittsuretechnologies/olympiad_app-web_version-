import { prisma } from '@/lib/prisma';
import { VIDEO_MAX_SCORE } from '@/lib/kosh';
import { NATIONAL_STAGE } from '@/lib/stateCompetition';
import { stateLevelResults } from '@/lib/state-result';

/**
 * Level 3 — National Level.
 *
 * Who:  each state's Rank 1 on the FROZEN State Toppers list (ties share
 *       Rank 1, so a state can send more than one). SuperAdmin forwards them
 *       (Result → National Level), which saves a NationalForward row with
 *       snapshots of their Level 1 % and State video %.
 *
 * National % = the average of four equal parts (25% each):
 *   Level 1 %          stage-1 holistic % (exam + both Olympiad videos), as forwarded
 *   State video %      their State Level video's total, out of 20
 *   Assessment %       Virtual Assessment marks ÷ max, typed in by SuperAdmin
 *                      (the assessment runs outside the app)
 *   National video %   their National Level theme video's total, out of 20,
 *                      once its evaluation is PUBLISHED
 * A part that isn't there yet counts as 0, the same rule as the other levels.
 *
 * National Winners: the top NATIONAL_TOP_N distinct National %s, and everyone
 * on them (ties share a rank).
 */

export const NATIONAL_TOP_N = 3;

const round1 = (n: number) => Math.round(n * 10) / 10;
const videoPct = (total: number) => round1((total / VIDEO_MAX_SCORE) * 100);

/** One student SuperAdmin may forward: Rank 1 of a state on the frozen State Toppers list. */
export interface NationalCandidate {
  olympiadCode: string;
  name: string;
  className: string | null;
  schoolName: string | null;
  schoolCode: string | null;
  district: string | null;
  state: string | null;
  stage1Percent: number;
  stateVideoPercent: number;
  stateHolisticPercent: number;
}

/**
 * The students who qualify for the National Level, from the frozen State
 * Toppers list (rank 1 of each state). `stateFrozen` is false when that list
 * has not been frozen yet: nobody qualifies off a live, still-moving list.
 */
export async function nationalCandidates(): Promise<{ stateFrozen: boolean; candidates: NationalCandidate[] }> {
  const frozen = await prisma.competitionWinner.findMany({ where: { level: 'STATE' } });
  if (frozen.length === 0) return { stateFrozen: false, candidates: [] };
  const firsts = frozen.filter(f => f.rank === 1);

  // The State video % is read from the live State Level result (the frozen row
  // keeps only the combined State Holistic %).
  const live = new Map((await stateLevelResults()).map(r => [r.olympiadCode, r]));
  const candidates = firsts.map(f => {
    const r = live.get(f.olympiadCode);
    const total = r?.video?.published ? r.video.totalScore : null;
    return {
      olympiadCode: f.olympiadCode,
      name: f.name,
      className: f.className,
      schoolName: f.schoolName,
      schoolCode: f.schoolCode,
      district: f.district,
      state: f.state,
      stage1Percent: f.stage1HolisticPercent ?? r?.stage1HolisticPercent ?? 0,
      stateVideoPercent: total !== null && total !== undefined ? videoPct(total) : 0,
      stateHolisticPercent: f.stateHolisticPercent,
    };
  }).sort((a, b) => (a.state || '').localeCompare(b.state || '') || a.name.localeCompare(b.name));
  return { stateFrozen: true, candidates };
}

export interface NationalCompetitorResult extends NationalCandidate {
  forwardedAt: Date;
  /** Has an app account on this Olympiad ID — needed to upload the National video. */
  hasAppAccount: boolean;
  assessment: { score: number; max: number; percent: number; enteredAt: Date | null } | null;
  video: { id: string; status: string; subCategory: string | null; evaluated: boolean; published: boolean; totalScore: number | null } | null;
  /** NO_VIDEO, AWAITING_MARKS (uploaded, marks not published yet) or SCORED. */
  videoProgress: 'NO_VIDEO' | 'AWAITING_MARKS' | 'SCORED';
  nationalVideoPercent: number | null;
  nationalPercent: number;
}

export async function nationalLevelResults(): Promise<NationalCompetitorResult[]> {
  const forwards = await prisma.nationalForward.findMany();
  if (forwards.length === 0) return [];

  const appUsers = await prisma.appUser.findMany({
    where: { olympiadId: { in: forwards.map(f => f.olympiadCode) } },
    select: { id: true, olympiadId: true },
  });
  const appUserByCode = new Map(appUsers.map(u => [u.olympiadId!, u]));

  const videos = appUsers.length
    ? await prisma.video.findMany({
        where: { competitionStage: NATIONAL_STAGE, appUserId: { in: appUsers.map(u => u.id) }, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, appUserId: true, status: true, subCategory: true,
          evaluations: { select: { totalScore: true, isPublished: true } },
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

  return forwards.map(f => {
    const appUser = appUserByCode.get(f.olympiadCode);
    const v = appUser ? videoByUser.get(appUser.id) : undefined;
    const published = v?.evaluations.find(e => e.isPublished) ?? null;
    const nationalVideoPercent = published ? videoPct(published.totalScore) : null;
    const assessment = f.assessmentScore !== null && f.assessmentMax
      ? { score: f.assessmentScore, max: f.assessmentMax, percent: round1((f.assessmentScore / f.assessmentMax) * 100), enteredAt: f.assessmentAt }
      : null;
    const parts = [f.stage1Percent, f.stateVideoPercent, assessment?.percent ?? 0, nationalVideoPercent ?? 0];

    return {
      olympiadCode: f.olympiadCode,
      name: f.name,
      className: f.className,
      schoolName: f.schoolName,
      schoolCode: f.schoolCode,
      district: f.district,
      state: f.state,
      stage1Percent: f.stage1Percent,
      stateVideoPercent: f.stateVideoPercent,
      stateHolisticPercent: f.stateHolisticPercent,
      forwardedAt: f.forwardedAt,
      hasAppAccount: !!appUser,
      assessment,
      video: v ? {
        id: v.id, status: v.status, subCategory: v.subCategory,
        evaluated: v.evaluations.length > 0, published: !!published, totalScore: published?.totalScore ?? null,
      } : null,
      videoProgress: !v || v.status === 'REJECTED' ? 'NO_VIDEO' : published ? 'SCORED' : 'AWAITING_MARKS',
      nationalVideoPercent,
      nationalPercent: round1(parts.reduce((s, p) => s + p, 0) / parts.length),
    } satisfies NationalCompetitorResult;
  }).sort((a, b) => b.nationalPercent - a.nationalPercent || a.name.localeCompare(b.name));
}

export interface NationalTier { rank: number; nationalPercent: number; students: NationalCompetitorResult[] }

/** National Winners: the top NATIONAL_TOP_N distinct National %s and everyone on each. */
export function nationalWinners(results: NationalCompetitorResult[]): NationalTier[] {
  const percents = Array.from(new Set(results.map(r => r.nationalPercent))).sort((a, b) => b - a).slice(0, NATIONAL_TOP_N);
  return percents.map((p, i) => ({ rank: i + 1, nationalPercent: p, students: results.filter(r => r.nationalPercent === p) }));
}

/** The CompetitionWinner rows a freeze of the National Winners saves. */
export function nationalWinnerRows(results: NationalCompetitorResult[], frozenBy: string | null) {
  return nationalWinners(results).flatMap(t => t.students.map(r => ({
    level: 'NATIONAL',
    rank: t.rank,
    olympiadCode: r.olympiadCode,
    name: r.name,
    className: r.className,
    schoolName: r.schoolName,
    schoolCode: r.schoolCode,
    district: r.district,
    state: r.state,
    stateHolisticPercent: r.stateHolisticPercent,
    stage1HolisticPercent: r.stage1Percent,
    nationalPercent: r.nationalPercent,
    // The four parts that made the National %.
    koshPercents: {
      level1: r.stage1Percent, stateVideo: r.stateVideoPercent,
      assessment: r.assessment?.percent ?? 0, nationalVideo: r.nationalVideoPercent ?? 0,
    },
    frozenBy,
  })));
}
