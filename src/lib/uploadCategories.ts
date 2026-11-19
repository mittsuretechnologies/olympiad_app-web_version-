import { prisma } from '@/lib/prisma';
import {
  type Audience, type BrowseGroup, type CategoryDTO, type SlotKind, type UploadAudience, browseGroups, classLetter,
  uniqueNames, uploadProblem,
} from '@/lib/uploadCategoryShared';

// Upload categories managed by the SuperAdmin (dashboard → Upload Categories).
// The app (GET /api/app/categories), the school portal, the Search / Home
// screens and every upload route read them from here.
//
// The first read on an empty database fills the tables with exactly the lists
// the app and the server used to have built in, so nothing changes for users
// until the SuperAdmin edits something.
//
// The Olympiad rules (one video per slot, locked once marked, results) are not
// decided here: they still go by the slot category's NAME, which the admin
// cannot change (lib/olympiadSlots.ts, lib/olympiad-categories.ts).

export * from '@/lib/uploadCategoryShared';

// ── Defaults (the previously built-in lists) ─────────────────────────────────

type SeedSub = [label: string, icon: string, classCodes?: string[]];
interface SeedCategory {
  key: string; label: string; audiences: Audience[]; slotKind: SlotKind; icon: string; color: string;
  searchCats?: string[]; searchLabel?: string;
  showInSearch: boolean; searchSortOrder: number; showOnHome: boolean; homeSortOrder: number;
  subs: SeedSub[];
}

const TALENT_SUBS: SeedSub[] = [
  // 'musical-notes-outline': the app used to ask for 'guitar-outline', which
  // Ionicons doesn't have (it drew a "?").
  ['Dance', 'body-outline'], ['Singing', 'mic-circle-outline'], ['Music (Instrument)', 'musical-notes-outline'],
  ['Acting', 'film-outline'], ['Yoga', 'fitness-outline'], ['Art & Craft', 'color-palette-outline'],
  ['Storytelling', 'chatbubble-ellipses-outline'], ['Magic', 'sparkles-outline'], ['Cooking', 'restaurant-outline'],
  ['Sports (Any Activity)', 'football-outline'], ['Poetry (Recitation)', 'book-outline'], ['Mimic', 'person-outline'],
  ['Skipping', 'infinite-outline'], ['Hula Hoop', 'sync-circle-outline'],
];
const RHYME_SUBS: SeedSub[] = [
  ['Twinkle Twinkle Little Star', 'star-outline'], ['Wheels on the Bus', 'bus-outline'],
  ['Johny Johny Yes Papa', 'happy-outline'], ['Rain Rain Go Away', 'rainy-outline'],
  ['Incy Wincy Spider', 'bug-outline'], ['Humpty Dumpty Sat on a Wall', 'egg-outline'],
  ['Baa Baa Black Sheep', 'paw-outline'], ['Five Little Ducks', 'water-outline'],
  ['Any Other Favourite Rhyme', 'musical-note-outline'],
];
const SPEECH_SUBS: SeedSub[] = [
  ['About Myself', 'person-outline'], ['About My Family', 'people-outline'], ['About My School', 'school-outline'],
  ['My Best Friend', 'heart-outline'], ['My Favourite Toy', 'gift-outline'], ['Any Other', 'mic-outline'],
];
const withClass = (subs: SeedSub[], codes: string[]): SeedSub[] => subs.map(([l, i]) => [l, i, codes]);

/**
 * The State Level competition category: only students forwarded to the State
 * Level (Result → State Level) can upload into it, one video each
 * (lib/stateCompetition.ts). No audiences, no Search card or Home row.
 */
const STATE_LEVEL_DEFAULT: SeedCategory = {
  key: 'state_level', label: 'State Level', audiences: [], slotKind: 'STATE',
  icon: 'ribbon-outline', color: '#B8860B',
  showInSearch: false, searchSortOrder: 90, showOnHome: false, homeSortOrder: 90,
  subs: [['Thoughts & Execution', 'bulb-outline']],
};

/**
 * The National Level competition category: only students forwarded to the
 * National Level (Result → National Level, their state's Rank 1) can upload
 * into it, one theme-based video each. Added closed: SuperAdmin opens it
 * (Upload Categories → National Level) when the theme is announced.
 */
const NATIONAL_LEVEL_DEFAULT: SeedCategory = {
  key: 'national_level', label: 'National Level', audiences: [], slotKind: 'NATIONAL',
  icon: 'trophy-outline', color: '#8E44AD',
  showInSearch: false, searchSortOrder: 91, showOnHome: false, homeSortOrder: 91,
  subs: [['Theme Video', 'bulb-outline']],
};

export const DEFAULT_CATEGORIES: SeedCategory[] = [
  {
    key: 'oly_a', label: 'Talent Performance', audiences: ['OLYMPIAD_STUDENT'], slotKind: 'OLY_A',
    icon: 'trophy-outline', color: '#8A6FCB',
    showInSearch: false, searchSortOrder: 7, showOnHome: false, homeSortOrder: 8,
    subs: [...TALENT_SUBS, ['Other', 'star-outline']],
  },
  {
    // Rhymes for PG / Nursery / LKG, Speech / Talent for UKG.
    key: 'oly_b', label: 'Rhymes / Speech', audiences: ['OLYMPIAD_STUDENT'], slotKind: 'OLY_B',
    icon: 'mic-outline', color: '#F5A623',
    showInSearch: false, searchSortOrder: 8, showOnHome: true, homeSortOrder: 1,
    subs: [...withClass(RHYME_SUBS, ['P', 'N', 'L']), ...withClass(SPEECH_SUBS, ['U'])],
  },
  {
    key: 'talent', label: 'Talent Performance', audiences: ['NORMAL', 'GENERAL_SCHOOL', 'OLYMPIAD_SCHOOL'], slotKind: 'NONE',
    icon: 'trophy-outline', color: '#8A6FCB',
    showInSearch: true, searchSortOrder: 0, showOnHome: true, homeSortOrder: 0,
    subs: TALENT_SUBS,
  },
  {
    // Olympiad slot B videos are stored as "Rhymes / Speech".
    key: 'rhymes', label: 'Rhymes', audiences: ['NORMAL', 'GENERAL_SCHOOL', 'OLYMPIAD_SCHOOL'], slotKind: 'NONE',
    icon: 'musical-note-outline', color: '#F5A623', searchCats: ['Rhymes / Speech'],
    showInSearch: true, searchSortOrder: 1, showOnHome: true, homeSortOrder: 2,
    subs: RHYME_SUBS,
  },
  {
    key: 'speech', label: 'Speech & Presentation', audiences: ['NORMAL', 'GENERAL_SCHOOL', 'OLYMPIAD_SCHOOL'], slotKind: 'NONE',
    icon: 'megaphone-outline', color: '#1FAE8E', searchCats: ['Rhymes / Speech'], searchLabel: 'Speech / Talent Presentation',
    showInSearch: true, searchSortOrder: 2, showOnHome: true, homeSortOrder: 3,
    subs: SPEECH_SUBS,
  },
  {
    // Home's Learning / Parenting rows are the SuperAdmin's curated videos
    // (/api/app/home-videos); this switch shows or hides them.
    key: 'learning', label: 'Learning', audiences: ['NORMAL'], slotKind: 'NONE',
    icon: 'school-outline', color: '#3E82E0',
    showInSearch: true, searchSortOrder: 3, showOnHome: true, homeSortOrder: 6,
    subs: [['Learning', 'school-outline']],
  },
  {
    key: 'parenting', label: 'Parenting', audiences: ['NORMAL'], slotKind: 'NONE',
    icon: 'heart-outline', color: '#E0607E',
    showInSearch: true, searchSortOrder: 4, showOnHome: true, homeSortOrder: 7,
    subs: [['Parenting', 'heart-outline']],
  },
  {
    key: 'school_activity', label: 'School Activity', audiences: ['GENERAL_SCHOOL', 'OLYMPIAD_SCHOOL'], slotKind: 'NONE',
    icon: 'ribbon-outline', color: '#128064',
    showInSearch: true, searchSortOrder: 5, showOnHome: true, homeSortOrder: 4,
    subs: [
      ['Annual Day', 'medal-outline'], ['Sports Day', 'football-outline'], ['Classroom Activity', 'book-outline'],
      ['Festival Celebration', 'sparkles-outline'], ['Competition', 'trophy-outline'], ['Field Trip', 'bus-outline'],
      ['Other', 'apps-outline'],
    ],
  },
  {
    // "Others", not "Other": "Other" is an Olympiad Talent option.
    key: 'others', label: 'Others', audiences: ['NORMAL'], slotKind: 'NONE',
    icon: 'apps-outline', color: '#5C6B8A',
    showInSearch: true, searchSortOrder: 6, showOnHome: true, homeSortOrder: 5,
    subs: [['Others', 'apps-outline']],
  },
  STATE_LEVEL_DEFAULT,
  NATIONAL_LEVEL_DEFAULT,
];

/** The defaults as DTOs — used when the tables cannot be read. */
function defaultDTOs(): CategoryDTO[] {
  return DEFAULT_CATEGORIES.map((c, i) => ({
    id: `default_${c.key}`, key: c.key, label: c.label, aliases: [], audiences: c.audiences, slotKind: c.slotKind,
    icon: c.icon, color: c.color, imageUrl: null, isActive: c.slotKind !== 'NATIONAL', sortOrder: i,
    showInSearch: c.showInSearch, searchSortOrder: c.searchSortOrder, searchLabel: c.searchLabel ?? null,
    searchCats: c.searchCats ?? [], showOnHome: c.showOnHome, homeSortOrder: c.homeSortOrder,
    subs: c.subs.map(([label, icon, classCodes], j) => ({
      id: `default_${c.key}_${j}`, label, aliases: [], icon, classCodes: classCodes ?? [], sortOrder: j, isActive: true,
    })),
  }));
}

/** Adds the State / National Level categories to a database seeded before they existed. */
async function ensureStateCategory(): Promise<void> {
  await ensureCompetitionCategory(STATE_LEVEL_DEFAULT, true);
  await ensureCompetitionCategory(NATIONAL_LEVEL_DEFAULT, false);
}

async function ensureCompetitionCategory(c: SeedCategory, isActive: boolean): Promise<void> {
  if ((await prisma.uploadCategory.count({ where: { slotKind: c.slotKind } })) > 0) return;
  const max = await prisma.uploadCategory.aggregate({ _max: { sortOrder: true } });
  try {
    await prisma.uploadCategory.create({
      data: {
        key: c.key, label: c.label, audiences: c.audiences, slotKind: c.slotKind, icon: c.icon, color: c.color, isActive,
        showInSearch: c.showInSearch, searchSortOrder: c.searchSortOrder,
        showOnHome: c.showOnHome, homeSortOrder: c.homeSortOrder,
        sortOrder: (max._max.sortOrder ?? -1) + 1,
        subs: { create: c.subs.map(([label, icon], j) => ({ label, icon, sortOrder: j })) },
      },
    });
  } catch (e: any) {
    if (e?.code !== 'P2002') throw e; // another request added it first
  }
}

/** Fills empty tables with the defaults. `key` is unique, so a race just skips duplicates. */
async function ensureSeeded(): Promise<void> {
  if ((await prisma.uploadCategory.count()) > 0) return ensureStateCategory();
  for (let i = 0; i < DEFAULT_CATEGORIES.length; i++) {
    const c = DEFAULT_CATEGORIES[i];
    try {
      await prisma.uploadCategory.create({
        data: {
          key: c.key, label: c.label, audiences: c.audiences, slotKind: c.slotKind, icon: c.icon, color: c.color,
          isActive: c.slotKind !== 'NATIONAL', // the National Level opens when SuperAdmin opens it
          searchCats: c.searchCats?.length ? [c.label, ...c.searchCats].join(',') : null,
          searchLabel: c.searchLabel ?? null,
          showInSearch: c.showInSearch, searchSortOrder: c.searchSortOrder,
          showOnHome: c.showOnHome, homeSortOrder: c.homeSortOrder,
          sortOrder: i,
          subs: {
            create: c.subs.map(([label, icon, classCodes], j) => ({ label, icon, classCodes: classCodes ?? [], sortOrder: j })),
          },
        },
      });
    } catch (e: any) {
      if (e?.code !== 'P2002') throw e; // another request seeded it first
    }
  }
}

// ── Reading ─────────────────────────────────────────────────────────────────

// Kept on globalThis, like the Prisma client (lib/prisma.ts): every route can
// get its own copy of this module, and an admin save must clear the one cache
// all of them read — otherwise a closed category would stay uploadable on the
// other routes until their copy expired. Other server processes (if any)
// still catch up within TTL_MS.
const holder = globalThis as unknown as { uploadCategoryCache?: { at: number; rows: CategoryDTO[] } | null };
const TTL_MS = 30_000;

export function invalidateCategoryCache() {
  holder.uploadCategoryCache = null;
}

/** Every category, open or closed, with every option (switched on or off). */
export async function loadAllCategories(): Promise<CategoryDTO[]> {
  const cache = holder.uploadCategoryCache;
  if (cache && Date.now() - cache.at < TTL_MS) return cache.rows;
  await ensureSeeded();
  const rows = await prisma.uploadCategory.findMany({
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    include: { subs: { orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }] } },
  });
  const dto: CategoryDTO[] = rows.map((r) => ({
    id: r.id, key: r.key, label: r.label, aliases: r.aliases ?? [], audiences: r.audiences ?? [],
    slotKind: r.slotKind, icon: r.icon, color: r.color, imageUrl: r.imageUrl,
    isActive: r.isActive, sortOrder: r.sortOrder,
    showInSearch: r.showInSearch, searchSortOrder: r.searchSortOrder, searchLabel: r.searchLabel,
    searchCats: uniqueNames((r.searchCats ?? '').split(',')),
    showOnHome: r.showOnHome, homeSortOrder: r.homeSortOrder,
    subs: r.subs.map((s) => ({
      id: s.id, label: s.label, aliases: s.aliases ?? [], icon: s.icon, classCodes: s.classCodes ?? [],
      sortOrder: s.sortOrder, isActive: s.isActive,
    })),
  }));
  holder.uploadCategoryCache = { at: Date.now(), rows: dto };
  return dto;
}

/** Like loadAllCategories, but falls back to the built-in lists if the tables can't be read. */
export async function loadCategoriesSafe(): Promise<CategoryDTO[]> {
  try {
    return await loadAllCategories();
  } catch (e) {
    console.error('upload categories: falling back to the built-in lists:', e);
    return defaultDTOs();
  }
}

/** What the app and the school portal get: every category, only the options that are switched on. */
export async function loadPublicCategories(): Promise<CategoryDTO[]> {
  const all = await loadAllCategories();
  return all.map((c) => ({ ...c, subs: c.subs.filter((s) => s.isActive) }));
}

// ── Search / Home ────────────────────────────────────────────────────────────

const eqi = (field: 'category' | 'subCategory', value: string) => ({ [field]: { equals: value, mode: 'insensitive' as const } });

/** Prisma condition for the videos a Search card / Home row shows (see browseGroups). */
export function browseWhere(group: BrowseGroup) {
  return {
    OR: [
      ...group.ownNames.map((n) => eqi('category', n)),
      ...group.extras.map((x) => ({
        AND: [
          eqi('category', x.name),
          ...(x.excludeSubs.length
            ? [{ OR: [{ subCategory: null }, { NOT: { OR: x.excludeSubs.map((s) => eqi('subCategory', s)) } }] }]
            : []),
        ],
      })),
    ],
  };
}

/** The Search card / Home row of the normal category with this key, or null. */
export async function findBrowseGroup(key: string): Promise<BrowseGroup | null> {
  return browseGroups(await loadCategoriesSafe()).find((g) => g.category.key === key) ?? null;
}

// ── Upload checks ────────────────────────────────────────────────────────────

/** Which kind of school a school account is: Olympiad (linked to a School row) or General. */
export async function schoolKindOf(appUserId: string): Promise<'OLYMPIAD' | 'GENERAL' | null> {
  const user = await prisma.appUser.findUnique({ where: { id: appUserId }, select: { schoolRefId: true } });
  if (!user) return null;
  return user.schoolRefId ? 'OLYMPIAD' : 'GENERAL';
}

/** Error message when this audience may not upload into category / subCategory, else null. */
export async function checkUploadCategory(
  audience: UploadAudience, category: string, subCategory: string,
): Promise<string | null> {
  return uploadProblem(await loadCategoriesSafe(), audience, category, subCategory);
}

/**
 * Error message when a student's Olympiad video may not go into category /
 * subCategory (it must be one of the two slot categories, with an option
 * offered to the student's class), else null.
 */
export async function checkOlympiadCategory(
  category: string, subCategory: string,
  student: { classCode?: string | null; olympiadCode?: string | null },
): Promise<string | null> {
  return uploadProblem(await loadCategoriesSafe(), 'OLYMPIAD_STUDENT', category, subCategory, {
    classLetter: classLetter(student.classCode, student.olympiadCode),
  });
}
