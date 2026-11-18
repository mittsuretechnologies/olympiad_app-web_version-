// Upload categories: types and pure helpers shared by the server
// (lib/uploadCategories.ts) and the browser pages (admin page, school portal,
// moderation). Client-safe: no server imports.
//
// The mobile app has the same rules in Components/store/uploadCategories.js —
// keep the two in step.

export const AUDIENCES = ['NORMAL', 'OLYMPIAD_STUDENT', 'GENERAL_SCHOOL', 'OLYMPIAD_SCHOOL'] as const;
export type Audience = (typeof AUDIENCES)[number];

export const AUDIENCE_LABELS: Record<Audience, string> = {
  NORMAL: 'General User',
  OLYMPIAD_STUDENT: 'Olympiad Student',
  GENERAL_SCHOOL: 'General School',
  OLYMPIAD_SCHOOL: 'Olympiad School',
};

/** Audiences a normal (non-slot) category can be given. Olympiad students use
 *  the General User list for their normal uploads. */
export const NORMAL_AUDIENCES: Audience[] = ['NORMAL', 'GENERAL_SCHOOL', 'OLYMPIAD_SCHOOL'];

/** NONE = a normal category; OLY_A / OLY_B = the two Olympiad slot categories;
 *  STATE = the State Level competition category (one video per competitor). */
export const SLOT_KINDS = ['NONE', 'OLY_A', 'OLY_B', 'STATE'] as const;
export type SlotKind = (typeof SLOT_KINDS)[number];

/** Who uploads into the State Level category: students forwarded to the State
 *  Level (Result → State Level). Not an admin-pickable audience. */
export const STATE_COMPETITOR = 'STATE_COMPETITOR';
export type UploadAudience = Audience | typeof STATE_COMPETITOR;

export interface SubCategoryDTO {
  id: string;
  label: string;
  aliases: string[];
  icon: string;
  /** Single-letter class codes (lib/classes.ts); empty = every class. */
  classCodes: string[];
  sortOrder: number;
  isActive: boolean;
}

export interface CategoryDTO {
  id: string;
  key: string;
  label: string;
  aliases: string[];
  audiences: string[];
  slotKind: string;
  icon: string;
  color: string;
  imageUrl: string | null;
  /** Open for uploads. A closed category can still show on Search / Home. */
  isActive: boolean;
  sortOrder: number;
  showInSearch: boolean;
  searchSortOrder: number;
  searchLabel: string | null;
  /** Extra stored category names the Search card also shows videos of. */
  searchCats: string[];
  showOnHome: boolean;
  homeSortOrder: number;
  subs: SubCategoryDTO[];
}

export const isSlot = (c: Pick<CategoryDTO, 'slotKind'>) => c.slotKind === 'OLY_A' || c.slotKind === 'OLY_B';

/** The State Level competition category. */
export const isStateCategory = (c: Pick<CategoryDTO, 'slotKind'>) => c.slotKind === 'STATE';

/** A normal category: neither an Olympiad slot nor the State Level one. Only
 *  these get Search cards, Home rows and the audiences' upload lists. */
export const isNormalCategory = (c: Pick<CategoryDTO, 'slotKind'>) => !isSlot(c) && !isStateCategory(c);

const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase();

/** Unique names, first spelling wins, ignoring case. */
export function uniqueNames(names: (string | null | undefined)[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const n of names) {
    const t = (n ?? '').trim();
    if (!t || seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    out.push(t);
  }
  return out;
}

/** Every stored category name that belongs to this category (Home rows). */
export const categoryNames = (c: Pick<CategoryDTO, 'label' | 'aliases'>) => uniqueNames([c.label, ...c.aliases]);

/** Every stored category name its Search card shows. */
export const searchNames = (c: Pick<CategoryDTO, 'label' | 'aliases' | 'searchCats'>) =>
  uniqueNames([c.label, ...c.aliases, ...c.searchCats]);

/** Every stored name of an option (current + earlier ones). */
export const subNames = (s: Pick<SubCategoryDTO, 'label' | 'aliases'>) => uniqueNames([s.label, ...s.aliases]);

/**
 * What a Search card / Home row of a normal category shows. The two Olympiad
 * categories have no card or row of their own — their videos show inside the
 * normal ones:
 *  - videos saved under the category's own names (any option). The normal and
 *    the Olympiad "Talent Performance" save the same name, so Olympiad Talent
 *    videos land here;
 *  - videos saved under an extra name it lists (searchCats, e.g. Rhymes and
 *    Speech & Presentation both list the Olympiad "Rhymes / Speech"), except
 *    those whose option belongs to another category listing that name. So an
 *    Olympiad rhyme goes to Rhymes and a UKG speech topic to Speech; an option
 *    no list knows (old free text) shows in all of them.
 */
export interface BrowseGroup {
  category: CategoryDTO;
  ownNames: string[];
  extras: { name: string; excludeSubs: string[] }[];
}

export function browseGroups(categories: CategoryDTO[]): BrowseGroup[] {
  const normal = categories.filter(isNormalCategory);
  const optionsOf = (c: CategoryDTO) => c.subs.flatMap((s) => subNames(s));
  return normal.map((c) => {
    const ownNames = categoryNames(c);
    const own = new Set(ownNames.map((n) => n.toLowerCase()));
    const mine = new Set(optionsOf(c).map((n) => n.toLowerCase()));
    const extras = c.searchCats
      .filter((name) => !own.has(name.toLowerCase()))
      .map((name) => {
        const siblings = normal.filter(
          (o) => o.id !== c.id && searchNames(o).some((n) => n.toLowerCase() === name.toLowerCase()),
        );
        const excludeSubs = uniqueNames(siblings.flatMap(optionsOf)).filter((s) => !mine.has(s.toLowerCase()));
        return { name, excludeSubs };
      });
    return { category: c, ownNames, extras };
  });
}

/**
 * A student's class letter: from the Olympiad ID (<CRM><LETTER><seq>, e.g.
 * 976586L0001 → L) when there is one, else from the class code / name.
 * Null when it can't be told.
 */
export function classLetter(classCode?: string | null, olympiadCode?: string | null): string | null {
  const m = (olympiadCode || '').match(/([A-Za-z]+)\d+$/);
  if (m) return m[1].slice(-1).toUpperCase();
  const c = norm(classCode);
  if (!c) return null;
  if (c.length === 1) return c.toUpperCase();
  if (c === 'ukg' || c === 'sr.kg' || c === 'srkg' || c === 'sr kg') return 'U';
  if (c === 'lkg' || c === 'jr.kg' || c === 'jrkg' || c === 'jr kg') return 'L';
  if (c === 'nursery') return 'N';
  if (c === 'pg' || c.replace(/[\s_-]/g, '') === 'prenursery') return 'P';
  return null;
}

/** Whether an option is offered to a class. An unknown class sees every option. */
export function subForClass(s: Pick<SubCategoryDTO, 'classCodes'>, letter: string | null): boolean {
  if (!s.classCodes.length || !letter) return true;
  return s.classCodes.includes(letter);
}

/** The Olympiad slot category (A or B). */
export function slotCategory(categories: CategoryDTO[], slot: 'A' | 'B'): CategoryDTO | undefined {
  return categories.find((c) => c.slotKind === (slot === 'A' ? 'OLY_A' : 'OLY_B'));
}

/**
 * What a picker offers. `audience` NORMAL / GENERAL_SCHOOL / OLYMPIAD_SCHOOL:
 * the open normal categories given to it. OLYMPIAD_STUDENT: the two slot
 * categories, their options cut to the student's class. STATE_COMPETITOR: the
 * State Level category, while it is open.
 * Only options that are switched on; categories left with none are dropped.
 */
export function uploadChoices(
  categories: CategoryDTO[],
  audience: UploadAudience,
  opts: { classLetter?: string | null } = {},
): CategoryDTO[] {
  const forSlots = audience === 'OLYMPIAD_STUDENT';
  const forState = audience === STATE_COMPETITOR;
  return categories
    .filter((c) => (forSlots ? isSlot(c)
      : forState ? isStateCategory(c) && c.isActive
      : isNormalCategory(c) && c.isActive && c.audiences.includes(audience)))
    .sort((a, b) => (forSlots ? a.slotKind.localeCompare(b.slotKind) : a.sortOrder - b.sortOrder))
    .map((c) => ({
      ...c,
      subs: c.subs
        .filter((s) => s.isActive && (!forSlots || subForClass(s, opts.classLetter ?? null)))
        .sort((a, b) => a.sortOrder - b.sortOrder),
    }))
    .filter((c) => c.subs.length > 0);
}

// ── Moderation: what an existing video may be moved to ──────────────────────

/** uploaderType stored on a school's own videos (see lib/generalSchool.ts). */
const UPLOADER_SCHOOL_OWN = 'SCHOOL_OWN';

/** Who uploaded a video, as far as categories go. */
export interface VideoUploader {
  isEvaluation: boolean;
  uploaderType?: string | null;
  /** For a school's own video: which kind of school. Unknown = either list. */
  schoolKind?: 'OLYMPIAD' | 'GENERAL' | null;
  /** 'STATE' for a State Level competition video. */
  competitionStage?: string | null;
}

/** The upload list(s) the video's uploader picks from in the app. */
export function videoAudiences(v: VideoUploader): UploadAudience[] {
  if (v.competitionStage === 'STATE') return [STATE_COMPETITOR];
  if (v.isEvaluation) return ['OLYMPIAD_STUDENT'];
  if (v.uploaderType === UPLOADER_SCHOOL_OWN) {
    if (v.schoolKind === 'OLYMPIAD') return ['OLYMPIAD_SCHOOL'];
    if (v.schoolKind === 'GENERAL') return ['GENERAL_SCHOOL'];
    return ['OLYMPIAD_SCHOOL', 'GENERAL_SCHOOL'];
  }
  return ['NORMAL'];
}

export interface CategoryGroup { label: string; subs: string[] }

/**
 * The categories (with their switched-on options) a moderator may move this
 * video between: exactly what its uploader gets in the app. An Olympiad video
 * gets both slot categories with every class's options.
 */
export function moveChoices(categories: CategoryDTO[], v: VideoUploader): CategoryGroup[] {
  const groups: CategoryGroup[] = [];
  for (const audience of videoAudiences(v)) {
    for (const c of uploadChoices(categories, audience)) {
      const subs = c.subs.map((s) => s.label);
      const same = groups.find((g) => norm(g.label) === norm(c.label));
      if (same) same.subs = uniqueNames([...same.subs, ...subs]);
      else groups.push({ label: c.label, subs });
    }
  }
  return groups;
}

/** Error message when the video may not be moved to category / subCategory, else null. */
export function moveProblem(
  categories: CategoryDTO[], v: VideoUploader, category: string, subCategory: string,
): string | null {
  const group = moveChoices(categories, v).find((g) => norm(g.label) === norm(category));
  if (!group || !group.subs.some((s) => norm(s) === norm(subCategory))) {
    return `"${subCategory}" under "${category}" is not a category this uploader can use.`;
  }
  return null;
}

/**
 * The Olympiad slot (A / B) a stored category / sub-category belongs to, from
 * the slot categories' current and earlier names. Null when neither. Only
 * meaningful for Olympiad videos: the normal Talent Performance shares slot
 * A's name. Callers keep the built-in lists as a fallback for old records.
 */
export function slotOfNames(
  categories: CategoryDTO[], category: string | null | undefined, subCategory: string | null | undefined,
): 'A' | 'B' | null {
  const cat = norm(category);
  if (cat === 'cat a') return 'A';
  if (cat === 'cat b') return 'B';
  const slots = categories.filter(isSlot);
  const slotLetter = (c: CategoryDTO) => (c.slotKind === 'OLY_A' ? 'A' : 'B');
  const byName = slots.find((c) => categoryNames(c).some((n) => norm(n) === cat));
  if (byName) return slotLetter(byName);
  const sub = norm(subCategory);
  if (!sub) return null;
  const bySub = slots.find((c) => c.subs.some((s) => subNames(s).some((n) => norm(n) === sub)));
  return bySub ? slotLetter(bySub) : null;
}

/**
 * Whether `category` / `subCategory` may be uploaded by this audience. Returns
 * an error message, or null when fine. Names compare ignoring case and outer
 * spaces; only the current names count (not aliases), as the app sends them.
 */
export function uploadProblem(
  categories: CategoryDTO[],
  audience: UploadAudience,
  category: string,
  subCategory: string,
  opts: { classLetter?: string | null } = {},
): string | null {
  const choices = uploadChoices(categories, audience, opts);
  const cat = choices.find((c) => norm(c.label) === norm(category));
  if (!cat) {
    return audience === 'OLYMPIAD_STUDENT'
      ? 'Pick one of the two Olympiad categories.'
      : audience === STATE_COMPETITOR
        ? 'The State Level category is not open for uploads right now.'
        : `"${category}" is not available for upload any more. Please update the app or pick another category.`;
  }
  if (!cat.subs.some((s) => norm(s.label) === norm(subCategory))) {
    return `"${subCategory}" is not available in ${cat.label} any more. Please update the app or pick another option.`;
  }
  return null;
}
