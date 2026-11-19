import { prisma } from '@/lib/prisma';
import { isNormalCategory, type CategoryDTO } from '@/lib/uploadCategoryShared';

// The order of everything on the app's Home screen, managed in dashboard →
// Upload Categories → Home Screen. One list: the normal categories (rows; their
// on/off switch is UploadCategory.showOnHome) and the other sections, which
// have their own switch in HomeLayoutItem.
//
// Not listed: "New Releases" (the app has dropped it) and the Olympiad row (not
// shown on Home).

export const SYSTEM_SECTIONS = [
  { key: 'mittfest', label: 'MittFest' },
  { key: 'trending', label: 'Trending Tots' },
  { key: 'school', label: 'Videos From Your School' },
] as const;

export interface HomeLayoutEntry {
  /** 'mittfest' | 'trending' | 'school' | 'cat:<category key>' */
  key: string;
  label: string;
  kind: 'section' | 'category';
  visible: boolean;
  sortOrder: number;
  /** Learning / Parenting categories draw the curated Learning & Parenting videos. */
  curated?: boolean;
}

const catKey = (c: Pick<CategoryDTO, 'key'>) => `cat:${c.key}`;

// The app's original order, used until the SuperAdmin first drags something.
const DEFAULT_RANK: Record<string, number> = {
  mittfest: 0, 'cat:learning': 1, 'cat:parenting': 2, school: 3, trending: 4,
};

/** Every Home item, in the SuperAdmin's order. */
export async function loadHomeLayout(categories: CategoryDTO[]): Promise<HomeLayoutEntry[]> {
  const rows = await prisma.homeLayoutItem.findMany();
  const saved = new Map(rows.map((r) => [r.key, r]));
  const hasSaved = rows.length > 0;
  // Items without a saved position (a new category, or nothing saved yet).
  const rank = (key: string, homeSortOrder: number) =>
    saved.get(key)?.sortOrder ?? (hasSaved ? 1000 : 0) + (DEFAULT_RANK[key] ?? 10 + homeSortOrder);

  const entries: HomeLayoutEntry[] = [
    ...SYSTEM_SECTIONS.map((s) => ({
      key: s.key, label: s.label, kind: 'section' as const,
      visible: saved.get(s.key)?.visible ?? true, sortOrder: rank(s.key, 0),
    })),
    ...categories.filter(isNormalCategory).map((c) => ({
      key: catKey(c), label: c.label, kind: 'category' as const,
      visible: c.showOnHome, sortOrder: rank(catKey(c), c.homeSortOrder),
      curated: c.key === 'learning' || c.key === 'parenting',
    })),
  ];
  return entries.sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
}

/** Saves the whole order (keys, top to bottom). Unknown keys are ignored. */
export async function saveHomeOrder(keys: string[], categories: CategoryDTO[]): Promise<void> {
  const valid = new Set([...SYSTEM_SECTIONS.map((s) => s.key as string), ...categories.filter(isNormalCategory).map(catKey)]);
  const ordered = keys.filter((k) => valid.has(k));
  const byKey = new Map(categories.map((c) => [catKey(c), c]));
  await prisma.$transaction([
    ...ordered.map((key, i) => prisma.homeLayoutItem.upsert({
      where: { key }, update: { sortOrder: i }, create: { key, sortOrder: i },
    })),
    // Keep the category's own order column in step (the Home feed sorts by it too).
    ...ordered.flatMap((key, i) => {
      const c = byKey.get(key);
      return c ? [prisma.uploadCategory.update({ where: { id: c.id }, data: { homeSortOrder: i } })] : [];
    }),
  ]);
}

/** Switches a non-category section on or off. */
export async function setSectionVisible(key: string, visible: boolean, categories: CategoryDTO[]): Promise<string | null> {
  if (!SYSTEM_SECTIONS.some((s) => s.key === key)) return 'Unknown section.';
  // Nothing saved yet: save the current order first, so the section keeps its place.
  if ((await prisma.homeLayoutItem.count()) === 0) {
    await saveHomeOrder((await loadHomeLayout(categories)).map((e) => e.key), categories);
  }
  await prisma.homeLayoutItem.upsert({ where: { key }, update: { visible }, create: { key, visible, sortOrder: 1000 } });
  return null;
}
