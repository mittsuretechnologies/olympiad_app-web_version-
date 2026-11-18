import { prisma } from '@/lib/prisma';
import {
  type CategoryDTO, STATE_COMPETITOR, isStateCategory, loadCategoriesSafe, uploadChoices, uploadProblem,
} from '@/lib/uploadCategories';

/**
 * State Level competition (the stage after the Olympiad result).
 *
 *  1. Result → State Level forwards everyone on the overall top 3 distinct
 *     holistic %s (DistrictForward, with a snapshot of their stage-1 kosha %s).
 *  2. Those students — and only they — can upload ONE video into the State
 *     Level category (slotKind 'STATE', dashboard → Upload Categories). It is
 *     stored with Video.competitionStage = 'STATE' and isEvaluation = false,
 *     so the stage-1 result, Olympiad slots and evaluator queue never count it.
 *  3. It is moderated and evaluated like an Olympiad video, then combined 50-50
 *     per kosha with the stage-1 snapshot into the State Holistic %.
 *
 * A competitor is matched by the Olympiad ID on their app account.
 */

export const STATE_STAGE = 'STATE';

/** The State Level category (open or not), or null if it can't be read. */
export async function stateCategory(): Promise<CategoryDTO | null> {
  return (await loadCategoriesSafe()).find(isStateCategory) ?? null;
}

/** Whether a category name is the State Level category's (current or earlier name). */
export function isStateCategoryName(cat: CategoryDTO | null, category: unknown): boolean {
  if (!cat || typeof category !== 'string') return false;
  const n = category.trim().toLowerCase();
  return [cat.label, ...cat.aliases].some((x) => x.trim().toLowerCase() === n);
}

/** The forward record of this Olympiad ID, or null when not a State Level competitor. */
export async function stateForwardOf(olympiadCode: string | null | undefined) {
  const code = (olympiadCode || '').trim().toUpperCase();
  if (!code) return null;
  return prisma.districtForward.findUnique({
    where: { olympiadCode: code },
    select: { olympiadCode: true, forwardedAt: true, holisticPercent: true },
  });
}

/**
 * The competitor's State Level videos, newest first. Soft-deleted ones are
 * included: an evaluated video keeps the slot even after removal.
 */
export function stateVideosOf(appUserId: string) {
  return prisma.video.findMany({
    where: { appUserId, competitionStage: STATE_STAGE },
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

/**
 * Error for a State Level upload by this app user, or null when it may go
 * ahead. `category` / `subCategory` must be the open State Level category and
 * one of its switched-on options.
 */
export async function checkStateUpload(
  appUserId: string, olympiadCode: string | null | undefined, category: string, subCategory: string,
): Promise<{ status: number; error: string } | null> {
  if (!(await stateForwardOf(olympiadCode))) {
    return { status: 403, error: 'Only students selected for the State Level can upload into this category.' };
  }
  const problem = uploadProblem(await loadCategoriesSafe(), STATE_COMPETITOR, category, subCategory);
  if (problem) return { status: 400, error: problem };
  if (stateSlotTaken(await stateVideosOf(appUserId))) {
    return { status: 409, error: 'You have already submitted your State Level video.' };
  }
  return null;
}

/** What the app shows a student about the State Level (GET /api/app/state-competition). */
export async function stateCompetitionFor(appUserId: string, olympiadCode: string | null | undefined) {
  const forward = await stateForwardOf(olympiadCode);
  if (!forward) return { eligible: false as const };

  const [categories, videos] = await Promise.all([loadCategoriesSafe(), stateVideosOf(appUserId)]);
  const open = uploadChoices(categories, STATE_COMPETITOR)[0] ?? null;
  const live = videos.find((v) => v.deletedAt === null) ?? null;
  const taken = stateSlotTaken(videos);

  return {
    eligible: true as const,
    forwardedAt: forward.forwardedAt,
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
