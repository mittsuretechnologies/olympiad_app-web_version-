// Hashtags added automatically to uploads from an Olympiad school's students
// (and the school's own account): state, district, school name and the
// school's CRM ID. Olympiad videos also carry their main category.
//
// The CRM ID replaced the internal school code as the school tag. Videos
// uploaded before that still carry the school code, so anything that finds a
// school's videos by tag must match both (see schoolTagWhere).
//
// Client-safe (no server imports): the moderation page uses it too.

import {
  OLYMPIAD_CAT_A_LABEL, OLYMPIAD_CAT_A_SUBS, OLYMPIAD_CAT_B_LABEL, OLYMPIAD_CAT_B_SUBS,
} from '@/lib/olympiad-categories';

const squash = (v: string) => v.replace(/\s+/g, '');

export function schoolAutoTags(school: {
  state?: string | null;
  district?: string | null;
  name?: string | null;
  olympiadId?: string | null;
} | null | undefined): string[] {
  if (!school) return [];
  const tags: string[] = [];
  if (school.state)    tags.push(squash(school.state));
  if (school.district) tags.push(squash(school.district));
  if (school.name)     tags.push(squash(school.name));
  const crm = squash(school.olympiadId || '');
  if (crm) tags.push(crm);
  return tags;
}

/** "Talent Performance" → "TalentPerformance", "Rhymes / Speech" → "RhymesSpeech".
 *  Older rows store 'Cat A' / 'Cat B', and some only a subcategory. */
export function mainCategoryTag(category?: string | null, subCategory?: string | null): string | null {
  // A stored main category wins; the subcategory only fills in when it's missing.
  let main = (category || '').trim();
  if (main === 'Cat A') main = OLYMPIAD_CAT_A_LABEL;
  else if (main === 'Cat B') main = OLYMPIAD_CAT_B_LABEL;
  else if (main !== OLYMPIAD_CAT_A_LABEL && main !== OLYMPIAD_CAT_B_LABEL) {
    if (OLYMPIAD_CAT_A_SUBS.includes(subCategory ?? '')) main = OLYMPIAD_CAT_A_LABEL;
    else if (OLYMPIAD_CAT_B_SUBS.includes(subCategory ?? '')) main = OLYMPIAD_CAT_B_LABEL;
  }
  const tag = main.replace(/[^\p{L}\p{N}]+/gu, '');
  return tag || null;
}

const CATEGORY_TAGS = new Set(
  [OLYMPIAD_CAT_A_LABEL, OLYMPIAD_CAT_B_LABEL].map((l) => mainCategoryTag(l)!.toLowerCase())
);

/** Default tags of a video: its school's tags, plus the main category for an
 *  Olympiad video. Client-safe, so the moderation page can preview them. */
export function videoDefaultTags(
  schoolTags: string[],
  video: { isEvaluation: boolean; category?: string | null; subCategory?: string | null },
): string[] {
  const category = video.isEvaluation ? mainCategoryTag(video.category, video.subCategory) : null;
  return [...schoolTags, ...(category ? [category] : [])];
}

/** Drops any Olympiad main-category tag (e.g. a stale #TalentPerformance after
 *  the video moved to Rhymes / Speech) so the current one can be added back. */
export function withoutCategoryTags(tags: string[]): string[] {
  return tags.filter((t) => !CATEGORY_TAGS.has(t.replace(/^#/, '').toLowerCase()));
}

/** Auto tags first, then the uploader's own, without duplicates (ignoring case). */
export function mergeTags(autoTags: (string | null)[], userTags: string | string[] | null | undefined): string {
  const own = Array.isArray(userTags)
    ? userTags
    : (userTags || '').split(',').map((t) => t.trim()).filter(Boolean);
  const seen = new Set<string>();
  return [...autoTags.filter((t): t is string => !!t), ...own]
    .filter((t) => {
      const key = t.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join(',');
}

// Exact match of one tag inside the comma-joined tags column, so CRM "S-738"
// doesn't also count "S-7381".
function exactTagWhere(tag: string) {
  const mode = 'insensitive' as const;
  return [
    { tags: { equals: tag, mode } },
    { tags: { startsWith: `${tag},`, mode } },
    { tags: { endsWith: `,${tag}`, mode } },
    { tags: { contains: `,${tag},`, mode } },
  ];
}

/** Videos tagged with this school: the old school-code tag or the CRM ID tag. */
export function schoolTagWhere(school: { schoolId: string; olympiadId?: string | null }) {
  const crm = squash(school.olympiadId || '');
  return {
    OR: [
      { tags: { contains: school.schoolId, mode: 'insensitive' as const } },
      ...(crm ? exactTagWhere(crm) : []),
    ],
  };
}
