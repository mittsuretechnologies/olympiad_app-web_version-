import { prisma } from '@/lib/prisma';
import { CLASSES } from '@/lib/classes';
import { OLYMPIAD_CAT_A_SUBS, OLYMPIAD_CAT_B_SUBS } from '@/lib/olympiad-categories';
import { IONICON_NAMES } from '@/lib/ioniconNames';
import {
  invalidateCategoryCache, loadAllCategories, NORMAL_AUDIENCES, isSlot, uniqueNames,
  type CategoryDTO,
} from '@/lib/uploadCategories';

// Write side of dashboard → Upload Categories (read side: lib/uploadCategories.ts).
//
// Rules that keep the Olympiad working:
//  - the two slot categories can't be created, deleted, renamed or closed, and
//    their options can be hidden but not deleted;
//  - an option name can't sit in both slots;
//  - every class keeps at least one option in each slot.
// A renamed category / option keeps its old name in `aliases`, so the videos
// already uploaded under it still show under it on Search and Home.

export interface SubInput { id?: string; label: string; icon?: string; classCodes?: string[]; isActive?: boolean }
export interface CategoryInput {
  label: string;
  audiences?: string[];
  icon?: string;
  color?: string;
  imageUrl?: string | null;
  isActive?: boolean;
  showInSearch?: boolean;
  searchLabel?: string | null;
  searchCats?: string[];
  showOnHome?: boolean;
  subs: SubInput[];
}

const MAX_NAME = 60;
// Only icons the app can draw; anything else would show as "?".
const ICONS = new Set(IONICON_NAMES);
const iconOr = (v: unknown, fallback: string) =>
  typeof v === 'string' && ICONS.has(v.trim()) ? v.trim() : fallback;
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
/** Class letters an option can be limited to: PG plus the Olympiad classes. */
export const CLASS_LETTERS = uniqueNames(['P', ...CLASSES.map((c) => c.code)]);
/** Classes every slot must keep an option for. */
const SLOT_CLASSES = CLASSES.map((c) => c.code);

const lower = (s: string) => s.trim().toLowerCase();

function nameProblem(name: unknown, what: string): string | null {
  if (typeof name !== 'string' || !name.trim()) return `${what} needs a name.`;
  if (name.trim().length > MAX_NAME) return `${what} "${name.trim().slice(0, 20)}…" is longer than ${MAX_NAME} characters.`;
  // Search sends lists of names joined by commas, so a name can't hold one.
  if (name.includes(',')) return `${what} "${name.trim()}" can't contain a comma.`;
  return null;
}

/** Cleans what the page sent. Returns the clean input, or an error message. */
export function cleanInput(body: any): CategoryInput | string {
  if (!body || typeof body !== 'object') return 'Nothing to save.';
  const labelProblem = nameProblem(body.label, 'The category');
  if (labelProblem) return labelProblem;
  if (!Array.isArray(body.subs)) return 'Options are missing.';

  const subs: SubInput[] = [];
  const seen = new Set<string>();
  for (const s of body.subs) {
    const p = nameProblem(s?.label, 'Every option');
    if (p) return p;
    const label = s.label.trim();
    if (seen.has(lower(label))) return `"${label}" is listed twice.`;
    seen.add(lower(label));
    const classCodes = Array.isArray(s.classCodes)
      ? uniqueNames(s.classCodes.map((c: unknown) => String(c).trim().toUpperCase()))
      : [];
    const badClass = classCodes.find((c) => !CLASS_LETTERS.includes(c));
    if (badClass) return `Unknown class "${badClass}" on "${label}".`;
    subs.push({
      id: typeof s.id === 'string' && s.id ? s.id : undefined,
      label,
      icon: iconOr(s.icon, 'star-outline'),
      classCodes,
      isActive: s.isActive !== false,
    });
  }

  const searchCats = Array.isArray(body.searchCats) ? body.searchCats : [];
  for (const n of searchCats) {
    const p = nameProblem(n, 'Every extra Search name');
    if (p) return p;
  }
  const imageUrl = typeof body.imageUrl === 'string' && body.imageUrl.trim() ? body.imageUrl.trim() : null;
  if (imageUrl && !/^(https?:\/\/|\/)/i.test(imageUrl)) return 'The card picture must be an uploaded image.';
  const searchLabel = typeof body.searchLabel === 'string' && body.searchLabel.trim() ? body.searchLabel.trim() : null;
  if (searchLabel && searchLabel.length > MAX_NAME) return `The Search card title is longer than ${MAX_NAME} characters.`;

  return {
    label: body.label.trim(),
    audiences: Array.isArray(body.audiences) ? uniqueNames(body.audiences.map(String)) : [],
    icon: iconOr(body.icon, 'apps-outline'),
    color: typeof body.color === 'string' && COLOR_RE.test(body.color.trim()) ? body.color.trim().toUpperCase() : '#5C6B8A',
    imageUrl,
    isActive: body.isActive !== false,
    showInSearch: body.showInSearch !== false,
    searchLabel,
    searchCats: uniqueNames(searchCats.map((n: string) => n.trim())),
    showOnHome: body.showOnHome === true,
    subs,
  };
}

/** Checks the clean input against the other categories. Error message or null. */
export async function checkAgainstOthers(input: CategoryInput, existing: CategoryDTO | null): Promise<string | null> {
  const all = await loadAllCategories();
  const others = all.filter((c) => c.id !== existing?.id);
  const slot = existing && isSlot(existing);

  if (slot) {
    if (lower(input.label) !== lower(existing.label)) {
      return `The Olympiad category "${existing.label}" can't be renamed: marks and results recognise its videos by this name.`;
    }
    // Options can be hidden, not deleted: old videos are classified by them.
    const kept = new Set(input.subs.map((s) => s.id).filter(Boolean));
    const dropped = existing.subs.find((s) => !kept.has(s.id));
    if (dropped) return `"${dropped.label}" is an Olympiad option and can't be deleted. Switch it off instead.`;
    // No option name in both slots — counting the other slot's earlier names
    // and its built-in list (older videos are told apart by these).
    const opposite = others.find((c) => isSlot(c) && c.slotKind !== existing.slotKind);
    const builtIn = existing.slotKind === 'OLY_A' ? OLYMPIAD_CAT_B_SUBS : OLYMPIAD_CAT_A_SUBS;
    const taken = new Set(
      [...(opposite?.subs.flatMap((s) => [s.label, ...s.aliases]) ?? []), ...builtIn].map(lower),
    );
    const clash = input.subs.find((s) => taken.has(lower(s.label)));
    if (clash) {
      return `"${clash.label}" belongs to the other Olympiad category${opposite ? ` ("${opposite.label}")` : ''}. An option can't be in both.`;
    }
    // Every class keeps something to pick in this slot.
    for (const code of SLOT_CLASSES) {
      const has = input.subs.some((s) => s.isActive && (!s.classCodes?.length || s.classCodes.includes(code)));
      if (!has) {
        const name = CLASSES.find((c) => c.code === code)?.name ?? code;
        return `${name} students would have no option left in "${existing.label}". Keep at least one switched on for them.`;
      }
    }
    return null;
  }

  // A normal category.
  const bad = (input.audiences ?? []).find((a) => !(NORMAL_AUDIENCES as string[]).includes(a));
  if (bad) return 'Pick who can upload into it: General User, General School and/or Olympiad School.';
  const sameName = others.find((c) => !isSlot(c) && [c.label, ...c.aliases].some((n) => lower(n) === lower(input.label)));
  if (sameName) {
    return lower(sameName.label) === lower(input.label)
      ? `There is already a category called "${sameName.label}".`
      : `"${input.label}" is an earlier name of "${sameName.label}" (its old videos use it). Pick another name.`;
  }
  if (input.isActive && (input.audiences?.length ?? 0) > 0 && !input.subs.some((s) => s.isActive)) {
    return 'Switch on at least one option, or close the category for uploads.';
  }
  return null;
}

/** Old names kept after a rename: previous aliases + the old name, minus the new name. */
function withOldName(aliases: string[], oldName: string, newName: string): string[] {
  if (lower(oldName) === lower(newName)) return aliases;
  return uniqueNames([...aliases, oldName]).filter((n) => lower(n) !== lower(newName));
}

const searchCatsColumn = (input: CategoryInput) => (input.searchCats?.length ? input.searchCats.join(',') : null);

function slug(label: string) {
  const base = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 30) || 'category';
  return `${base}_${Math.random().toString(36).slice(2, 7)}`;
}

export async function createCategory(input: CategoryInput): Promise<string> {
  const max = await prisma.uploadCategory.aggregate({
    _max: { sortOrder: true, searchSortOrder: true, homeSortOrder: true },
  });
  const row = await prisma.uploadCategory.create({
    data: {
      key: slug(input.label),
      label: input.label,
      audiences: input.audiences ?? [],
      slotKind: 'NONE',
      icon: input.icon!, color: input.color!, imageUrl: input.imageUrl ?? null,
      isActive: input.isActive !== false,
      showInSearch: input.showInSearch !== false, searchLabel: input.searchLabel ?? null,
      searchCats: searchCatsColumn(input),
      showOnHome: input.showOnHome === true,
      sortOrder: (max._max.sortOrder ?? -1) + 1,
      searchSortOrder: (max._max.searchSortOrder ?? -1) + 1,
      homeSortOrder: (max._max.homeSortOrder ?? -1) + 1,
      subs: {
        create: input.subs.map((s, i) => ({
          label: s.label, icon: s.icon!, classCodes: s.classCodes ?? [], isActive: s.isActive !== false, sortOrder: i,
        })),
      },
    },
  });
  invalidateCategoryCache();
  return row.id;
}

export async function updateCategory(existing: CategoryDTO, input: CategoryInput): Promise<void> {
  const slot = isSlot(existing);
  const oldSubs = new Map(existing.subs.map((s) => [s.id, s]));
  await prisma.$transaction(async (tx) => {
    await tx.uploadCategory.update({
      where: { id: existing.id },
      data: {
        // A slot category keeps its name, audience and stays open.
        label: slot ? existing.label : input.label,
        aliases: slot ? existing.aliases : withOldName(existing.aliases, existing.label, input.label),
        audiences: slot ? existing.audiences : input.audiences ?? [],
        isActive: slot ? true : input.isActive !== false,
        icon: input.icon!, color: input.color!, imageUrl: input.imageUrl ?? null,
        showInSearch: input.showInSearch !== false, searchLabel: input.searchLabel ?? null,
        searchCats: searchCatsColumn(input),
        showOnHome: input.showOnHome === true,
      },
    });
    const keep = input.subs.map((s) => s.id).filter((id): id is string => !!id && oldSubs.has(id));
    if (!slot) {
      await tx.uploadSubCategory.deleteMany({ where: { categoryId: existing.id, id: { notIn: keep } } });
    }
    for (let i = 0; i < input.subs.length; i++) {
      const s = input.subs[i];
      const data = { label: s.label, icon: s.icon!, classCodes: s.classCodes ?? [], isActive: s.isActive !== false, sortOrder: i };
      const old = s.id ? oldSubs.get(s.id) : undefined;
      if (old) {
        await tx.uploadSubCategory.update({
          where: { id: old.id },
          data: { ...data, aliases: withOldName(old.aliases, old.label, s.label) },
        });
      } else {
        await tx.uploadSubCategory.create({ data: { ...data, categoryId: existing.id } });
      }
    }
  });
  invalidateCategoryCache();
}

/** Quick switches from the list: open for uploads, Search, Home. */
export async function setCategoryFlags(
  existing: CategoryDTO, flags: { isActive?: unknown; showInSearch?: unknown; showOnHome?: unknown },
): Promise<string | null> {
  const data: { isActive?: boolean; showInSearch?: boolean; showOnHome?: boolean } = {};
  if (typeof flags.isActive === 'boolean') {
    if (isSlot(existing)) return 'An Olympiad category is always open for uploads.';
    data.isActive = flags.isActive;
  }
  if (typeof flags.showInSearch === 'boolean') data.showInSearch = flags.showInSearch;
  if (typeof flags.showOnHome === 'boolean') data.showOnHome = flags.showOnHome;
  if (Object.keys(data).length === 0) return 'Nothing to change.';
  await prisma.uploadCategory.update({ where: { id: existing.id }, data });
  invalidateCategoryCache();
  return null;
}

export const ORDER_LISTS = { upload: 'sortOrder', search: 'searchSortOrder', home: 'homeSortOrder' } as const;

/** Saves one of the three display orders; `ids` is the whole list in its new order. */
export async function saveOrder(list: keyof typeof ORDER_LISTS, ids: string[]): Promise<void> {
  const field = ORDER_LISTS[list];
  await prisma.$transaction(
    ids.map((id, i) => prisma.uploadCategory.update({ where: { id }, data: { [field]: i } })),
  );
  invalidateCategoryCache();
}

/** Deletes a normal category. Videos keep their category name as text. */
export async function deleteCategory(existing: CategoryDTO): Promise<string | null> {
  if (isSlot(existing)) return 'The Olympiad categories can\'t be deleted.';
  await prisma.uploadCategory.delete({ where: { id: existing.id } });
  invalidateCategoryCache();
  return null;
}

/** One category by id, fresh from the database. */
export async function findCategory(id: string): Promise<CategoryDTO | null> {
  invalidateCategoryCache();
  return (await loadAllCategories()).find((c) => c.id === id) ?? null;
}
