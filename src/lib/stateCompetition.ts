import { prisma } from '@/lib/prisma';
import {
  type CategoryDTO, NATIONAL_COMPETITOR, STATE_COMPETITOR, isNationalCategory, isStateCategory,
  loadCategoriesSafe, uploadChoices, uploadProblem,
} from '@/lib/uploadCategories';

/**
 * State and National Level competitions (the stages after the Olympiad result).
 *
 *  1. Result → State Level forwards everyone on each district's top 10
 *     distinct holistic %s (DistrictForward, with a snapshot of their stage-1
 *     kosha %s).
 *  2. Those students — and only they — can upload ONE video into the State
 *     Level category (slotKind 'STATE', dashboard → Upload Categories). It is
 *     stored with Video.competitionStage = 'STATE' and isEvaluation = false,
 *     so the stage-1 result, Olympiad slots and evaluator queue never count it.
 *  3. It is moderated and evaluated like an Olympiad video, then combined 50-50
 *     per kosha with the stage-1 snapshot into the State Holistic %.
 *  4. Result → National Level forwards each state's Rank 1 on the frozen State
 *     Toppers list (NationalForward). They upload ONE theme video into the
 *     National Level category (slotKind 'NATIONAL', competitionStage
 *     'NATIONAL'); see lib/national-result.ts for the National %.
 *
 * A competitor is matched by the Olympiad ID on their app account. The app
 * knows only one competition endpoint and one "isStateLevel" upload flag, so
 * both answer for the student's CURRENT stage: National once they are
 * forwarded there, else State.
 */

export const STATE_STAGE = 'STATE';
export const NATIONAL_STAGE = 'NATIONAL';
export type CompetitionStage = typeof STATE_STAGE | typeof NATIONAL_STAGE;

const STAGE_NAME: Record<CompetitionStage, string> = { STATE: 'State Level', NATIONAL: 'National Level' };

/** The State Level category (open or not), or null if it can't be read. */
export async function stateCategory(): Promise<CategoryDTO | null> {
  return (await loadCategoriesSafe()).find(isStateCategory) ?? null;
}

/** The National Level category (open or not), or null if it can't be read. */
export async function nationalCategory(): Promise<CategoryDTO | null> {
  return (await loadCategoriesSafe()).find(isNationalCategory) ?? null;
}

/** Whether a category name is that category's (current or earlier name). */
export function isStateCategoryName(cat: CategoryDTO | null, category: unknown): boolean {
  if (!cat || typeof category !== 'string') return false;
  const n = category.trim().toLowerCase();
  return [cat.label, ...cat.aliases].some((x) => x.trim().toLowerCase() === n);
}

/** Whether a category name belongs to the State or the National Level category. */
export async function isCompetitionCategoryName(category: unknown): Promise<boolean> {
  const [state, national] = await Promise.all([stateCategory(), nationalCategory()]);
  return isStateCategoryName(state, category) || isStateCategoryName(national, category);
}

const codeOf = (olympiadCode: string | null | undefined) => (olympiadCode || '').trim().toUpperCase();

/** The forward record of this Olympiad ID, or null when not a State Level competitor. */
export async function stateForwardOf(olympiadCode: string | null | undefined) {
  const code = codeOf(olympiadCode);
  if (!code) return null;
  return prisma.districtForward.findUnique({
    where: { olympiadCode: code },
    select: { olympiadCode: true, forwardedAt: true, holisticPercent: true },
  });
}

/** The National forward record of this Olympiad ID, or null (also before its table exists). */
export async function nationalForwardOf(olympiadCode: string | null | undefined) {
  const code = codeOf(olympiadCode);
  if (!code) return null;
  try {
    return await prisma.nationalForward.findUnique({ where: { olympiadCode: code }, select: { olympiadCode: true, forwardedAt: true } });
  } catch { return null; /* 2026-11-18-national-level.sql not run yet */ }
}

/** The competition this student is in right now: National once forwarded there, else State, else none. */
export async function currentStageOf(olympiadCode: string | null | undefined) {
  const national = await nationalForwardOf(olympiadCode);
  if (national) return { stage: NATIONAL_STAGE as CompetitionStage, forwardedAt: national.forwardedAt };
  const state = await stateForwardOf(olympiadCode);
  if (state) return { stage: STATE_STAGE as CompetitionStage, forwardedAt: state.forwardedAt };
  return null;
}

/**
 * The competitor's videos of one stage, newest first. Soft-deleted ones are
 * included: an evaluated video keeps the slot even after removal.
 */
export function stateVideosOf(appUserId: string, stage: CompetitionStage = STATE_STAGE) {
  return prisma.video.findMany({
    where: { appUserId, competitionStage: stage },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, status: true, rejectionReason: true, deletedAt: true, createdAt: true,
      category: true, subCategory: true, videoUrl: true, thumbnailUrl: true,
      evaluations: { select: { id: true, isPublished: true } },
    },
  });
}

/** Same rule as an Olympiad slot: used while a live, non-rejected video is in it, or once one is evaluated. */
export function stateSlotTaken(videos: Awaited<ReturnType<typeof stateVideosOf>>): boolean {
  return videos.some((v) => v.evaluations.length > 0 || (v.deletedAt === null && v.status !== 'REJECTED'));
}

const audienceOf = (stage: CompetitionStage) => (stage === NATIONAL_STAGE ? NATIONAL_COMPETITOR : STATE_COMPETITOR);

/**
 * Checks a competition upload by this app user, for their current stage.
 * `category` / `subCategory` must be that stage's open category and one of its
 * switched-on options. Returns the stage to store, or an error.
 */
export async function checkStateUpload(
  appUserId: string, olympiadCode: string | null | undefined, category: string, subCategory: string,
): Promise<{ stage: CompetitionStage; error?: undefined } | { status: number; error: string }> {
  const current = await currentStageOf(olympiadCode);
  if (!current) {
    return { status: 403, error: 'Only students selected for the State or National Level can upload into this category.' };
  }
  const problem = uploadProblem(await loadCategoriesSafe(), audienceOf(current.stage), category, subCategory);
  if (problem) return { status: 400, error: problem };
  if (stateSlotTaken(await stateVideosOf(appUserId, current.stage))) {
    return { status: 409, error: `You have already submitted your ${STAGE_NAME[current.stage]} video.` };
  }
  return { stage: current.stage };
}

/** What the app shows a student about their competition (GET /api/app/state-competition). */
export async function stateCompetitionFor(appUserId: string, olympiadCode: string | null | undefined) {
  const current = await currentStageOf(olympiadCode);
  if (!current) return { eligible: false as const };

  const [categories, videos] = await Promise.all([loadCategoriesSafe(), stateVideosOf(appUserId, current.stage)]);
  const open = uploadChoices(categories, audienceOf(current.stage))[0] ?? null;
  const live = videos.find((v) => v.deletedAt === null) ?? null;
  const taken = stateSlotTaken(videos);

  return {
    eligible: true as const,
    /** 'STATE' | 'NATIONAL': which competition the fields below are about. */
    stage: current.stage,
    stageName: STAGE_NAME[current.stage],
    forwardedAt: current.forwardedAt,
    // The category to upload into while it is open (with its switched-on options), else null.
    category: open,
    canUpload: !!open && !taken,
    video: live
      ? {
          id: live.id,
          status: live.status,
          rejectionReason: live.rejectionReason,
          category: live.category,
          subCategory: live.subCategory,
          thumbnailUrl: live.thumbnailUrl,
          evaluated: live.evaluations.length > 0,
          resultPublished: live.evaluations.some((e) => e.isPublished),
          createdAt: live.createdAt,
        }
      : null,
  };
}
