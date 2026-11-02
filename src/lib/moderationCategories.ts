// Which main categories / sub-categories a moderator may move a video between,
// by who uploaded it, the same way the mobile app offers them at upload time:
//   - Olympiad (jury) video  -> Talent Performance / Rhymes / Speech only (A/B slot)
//   - General School's own   -> Talent, Rhymes, Speech + School Activity
//   - Any other app user     -> Talent, Rhymes, Speech + Learning, Parenting, Others
// Labels are stored as-is in Video.category / subCategory, so they must match
// Olympiad_App/Components/screens/app/UploadScreen.js.
//
// Client-safe (no server imports): the moderation page and its API both use it.

import {
  OLYMPIAD_CAT_A_LABEL, OLYMPIAD_CAT_A_OPTIONS, OLYMPIAD_CAT_B_LABEL,
  OLYMPIAD_CAT_B_RHYMES_SUBS, OLYMPIAD_CAT_B_SPEECH_SUBS,
} from '@/lib/olympiad-categories';
import { SCHOOL_CATEGORY_GROUPS } from '@/lib/schoolUploadCategories';

export interface CategoryGroup { label: string; subs: readonly string[] }

/** uploaderType stored on a General School's own videos (see lib/generalSchool.ts). */
const UPLOADER_SCHOOL_OWN = 'SCHOOL_OWN';

const TALENT_LABEL = OLYMPIAD_CAT_A_LABEL; // 'Talent Performance'
const RHYMES_LABEL = 'Rhymes';
const SPEECH_LABEL = 'Speech & Presentation';

// The app's general-user lists: Talent has no "Other" (that one is Olympiad only).
const GENERAL_TALENT_SUBS = OLYMPIAD_CAT_A_OPTIONS.filter((s) => s !== 'Other');

export const SCHOOL_ACTIVITY_LABEL = 'School Activity';

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
const SCHOOL_GROUPS: CategoryGroup[] = SCHOOL_CATEGORY_GROUPS;

export function categoryGroupsFor(video: { isEvaluation: boolean; uploaderType?: string | null }): CategoryGroup[] {
  if (video.isEvaluation) return OLYMPIAD_GROUPS;
  return video.uploaderType === UPLOADER_SCHOOL_OWN ? SCHOOL_GROUPS : GENERAL_GROUPS;
}

/**
 * The group a video currently sits in, so the main-category select is never
 * blank. Older rows store 'Cat A' / 'Cat B', or only a sub-category.
 */
export function currentGroupLabel(
  video: { isEvaluation: boolean; uploaderType?: string | null; category: string | null; subCategory: string | null },
): string {
  const groups = categoryGroupsFor(video);
  const cat = (video.category ?? '').trim();
  const byLabel = groups.find((g) => g.label.toLowerCase() === cat.toLowerCase());
  if (byLabel) return byLabel.label;
  if (cat === 'Cat A') return groups[0].label;
  if (cat === 'Cat B') return video.isEvaluation ? groups[1].label : RHYMES_LABEL;
  const bySub = groups.find((g) => g.subs.includes(video.subCategory ?? ''));
  return (bySub ?? groups[0]).label;
}

/** True when `category` / `subCategory` is a pair the video's uploader could have picked in the app. */
export function isAllowedCategory(
  video: { isEvaluation: boolean; uploaderType?: string | null },
  category: string,
  subCategory: string,
): boolean {
  const group = categoryGroupsFor(video).find((g) => g.label === category);
  return !!group && group.subs.includes(subCategory);
}
