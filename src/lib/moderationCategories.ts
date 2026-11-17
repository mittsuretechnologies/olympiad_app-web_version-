// Which main categories / sub-categories a moderator may move a video between,
// by who uploaded it, the same way the app offers them at upload time:
//   - Olympiad (jury) video  -> the two Olympiad slot categories only (A/B slot)
//   - A school's own video   -> the Olympiad School / General School list
//   - Any other app user     -> the General User list
//
// The lists come from dashboard → Upload Categories (pass `categories`). The
// built-in lists below are only the fallback for when those can't be loaded
// (e.g. the moderation page before its request returns).
//
// Client-safe (no server imports): the moderation page and its API both use it.

import {
  OLYMPIAD_CAT_A_LABEL, OLYMPIAD_CAT_A_OPTIONS, OLYMPIAD_CAT_B_LABEL,
  OLYMPIAD_CAT_B_RHYMES_SUBS, OLYMPIAD_CAT_B_SPEECH_SUBS,
} from '@/lib/olympiad-categories';
import { SCHOOL_CATEGORY_GROUPS } from '@/lib/schoolUploadCategories';
import {
  type CategoryDTO, type CategoryGroup, type VideoUploader, moveChoices, moveProblem, slotCategory,
} from '@/lib/uploadCategoryShared';

export type { CategoryGroup, VideoUploader } from '@/lib/uploadCategoryShared';

/** uploaderType stored on a General School's own videos (see lib/generalSchool.ts). */
const UPLOADER_SCHOOL_OWN = 'SCHOOL_OWN';

const TALENT_LABEL = OLYMPIAD_CAT_A_LABEL; // 'Talent Performance'
const RHYMES_LABEL = 'Rhymes';
const SPEECH_LABEL = 'Speech & Presentation';

// The app's general-user lists: Talent has no "Other" (that one is Olympiad only).
const GENERAL_TALENT_SUBS = OLYMPIAD_CAT_A_OPTIONS.filter((s) => s !== 'Other');

export const SCHOOL_ACTIVITY_LABEL = 'School Activity';

// ── Built-in fallback ────────────────────────────────────────────────────────

const OLYMPIAD_GROUPS: CategoryGroup[] = [
  { label: OLYMPIAD_CAT_A_LABEL, subs: OLYMPIAD_CAT_A_OPTIONS },
  { label: OLYMPIAD_CAT_B_LABEL, subs: [...OLYMPIAD_CAT_B_RHYMES_SUBS, ...OLYMPIAD_CAT_B_SPEECH_SUBS] },
];

const GENERAL_GROUPS: CategoryGroup[] = [
  { label: TALENT_LABEL, subs: GENERAL_TALENT_SUBS },
  { label: RHYMES_LABEL, subs: OLYMPIAD_CAT_B_RHYMES_SUBS },
  { label: SPEECH_LABEL, subs: OLYMPIAD_CAT_B_SPEECH_SUBS },
  { label: 'Learning', subs: ['Learning'] },
  { label: 'Parenting', subs: ['Parenting'] },
  { label: 'Others', subs: ['Others'] },
];

// SCHOOL_CATEGORY_GROUPS is Talent / Rhymes / Speech / School Activity, already
// in the app's labels.
const SCHOOL_GROUPS: CategoryGroup[] = SCHOOL_CATEGORY_GROUPS.map((g) => ({ label: g.label, subs: [...g.subs] }));

function builtInGroupsFor(video: VideoUploader): CategoryGroup[] {
  if (video.isEvaluation) return OLYMPIAD_GROUPS;
  return video.uploaderType === UPLOADER_SCHOOL_OWN ? SCHOOL_GROUPS : GENERAL_GROUPS;
}

// ── API ──────────────────────────────────────────────────────────────────────

/** The groups this video's uploader gets: from `categories` when given, else the built-in lists. */
export function categoryGroupsFor(video: VideoUploader, categories?: CategoryDTO[] | null): CategoryGroup[] {
  if (categories?.length) {
    const groups = moveChoices(categories, video);
    if (groups.length) return groups;
  }
  return builtInGroupsFor(video);
}

/**
 * The group a video currently sits in, so the main-category select is never
 * blank. Older rows store 'Cat A' / 'Cat B', or only a sub-category. A video
 * whose category is no longer offered keeps its own name.
 */
export function currentGroupLabel(
  video: VideoUploader & { category: string | null; subCategory: string | null },
  categories?: CategoryDTO[] | null,
): string {
  const groups = categoryGroupsFor(video, categories);
  const cat = (video.category ?? '').trim();
  const byLabel = groups.find((g) => g.label.toLowerCase() === cat.toLowerCase());
  if (byLabel) return byLabel.label;
  const slotLabel = (slot: 'A' | 'B', fallback: string) =>
    (categories?.length ? slotCategory(categories, slot)?.label : undefined) ?? fallback;
  if (cat === 'Cat A') return slotLabel('A', groups[0]?.label ?? OLYMPIAD_CAT_A_LABEL);
  if (cat === 'Cat B') return video.isEvaluation ? slotLabel('B', OLYMPIAD_CAT_B_LABEL) : RHYMES_LABEL;
  if (cat) return cat;
  const bySub = groups.find((g) => g.subs.includes(video.subCategory ?? ''));
  return (bySub ?? groups[0])?.label ?? '';
}

/** True when `category` / `subCategory` is a pair the video's uploader could pick in the app. */
export function isAllowedCategory(
  video: VideoUploader,
  category: string,
  subCategory: string,
  categories?: CategoryDTO[] | null,
): boolean {
  if (categories?.length) return moveProblem(categories, video, category, subCategory) === null;
  const group = builtInGroupsFor(video).find((g) => g.label === category);
  return !!group && group.subs.includes(subCategory);
}
