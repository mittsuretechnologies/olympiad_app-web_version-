import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { isSlot, loadCategoriesSafe, subNames, uniqueNames, type CategoryDTO } from '@/lib/uploadCategories';
import { visibilityWhere } from '@/lib/videoVisibility';
import {
  DEFAULT_TRENDING_SETTINGS, cleanTrendingSettings, isOptionOn, istDay, pickForDay,
  type TrendingOption, type TrendingSettings, type TrendingView,
} from '@/lib/trendingTotsShared';

// Trending Tots, server side (rules: lib/trendingTotsShared.ts). The Home feed
// (/api/reels/home) asks for today's option; the SuperAdmin sets the rotation
// in dashboard → Upload Categories → Home Screen.
//
// Stored in AppSetting (no table of its own):
//   TRENDING_TOTS        the settings (JSON)
//   TRENDING_TOTS_TODAY  today's option, fixed the first time it is picked, so
//                        the row can't switch mid-day when an option gains or
//                        loses videos. Saving the settings clears it.

export * from '@/lib/trendingTotsShared';

const SETTINGS_KEY = 'TRENDING_TOTS';
const TODAY_KEY = 'TRENDING_TOTS_TODAY';

export async function loadTrendingSettings(): Promise<TrendingSettings> {
  const row = await prisma.appSetting.findUnique({ where: { key: SETTINGS_KEY } });
  if (!row) return cleanTrendingSettings(DEFAULT_TRENDING_SETTINGS);
  try {
    return cleanTrendingSettings(JSON.parse(row.value));
  } catch {
    return cleanTrendingSettings(DEFAULT_TRENDING_SETTINGS);
  }
}

/** Saves the settings (cleaned) and lets today's option be picked again under them. */
export async function saveTrendingSettings(raw: unknown): Promise<TrendingSettings> {
  const settings = cleanTrendingSettings(raw);
  const value = JSON.stringify(settings);
  await prisma.$transaction([
    prisma.appSetting.upsert({ where: { key: SETTINGS_KEY }, update: { value }, create: { key: SETTINGS_KEY, value } }),
    prisma.appSetting.deleteMany({ where: { key: TODAY_KEY } }),
  ]);
  invalidateTrendingCache();
  return settings;
}

// ── Options ───────────────────────────────────────────────────────────────────

/**
 * The rotation's options: every switched-on option of the normal categories,
 * one per name (Talent's "Dance" and a school list's "Dance" are one option).
 * An Olympiad option with the same name pools in, so Olympiad Dance videos
 * count as Dance; earlier names (after a rename) count too.
 */
export function trendingOptions(categories: CategoryDTO[], counts: Map<string, number>): TrendingOption[] {
  const byName = new Map<string, TrendingOption>();
  const normal = categories.filter((c) => !isSlot(c)).sort((a, b) => a.sortOrder - b.sortOrder);
  for (const c of normal) {
    for (const s of [...c.subs].sort((a, b) => a.sortOrder - b.sortOrder)) {
      const key = s.label.trim().toLowerCase();
      if (!s.isActive || !key) continue;
      let o = byName.get(key);
      if (!o) {
        o = { key, name: s.label.trim(), names: [], categories: [], videos: 0 };
        byName.set(key, o);
      }
      o.names = uniqueNames([...o.names, ...subNames(s)]);
      if (!o.categories.includes(c.label)) o.categories.push(c.label);
    }
  }
  for (const c of categories.filter(isSlot)) {
    for (const s of c.subs) {
      const names = subNames(s);
      const o = names.map((n) => byName.get(n.toLowerCase())).find(Boolean);
      if (o) o.names = uniqueNames([...o.names, ...names]);
    }
  }
  const options = [...byName.values()];
  for (const o of options) o.videos = o.names.reduce((sum, n) => sum + (counts.get(n.toLowerCase()) ?? 0), 0);
  return options;
}

/** Approved videos anyone can see, per stored option name (lower case). */
async function approvedCounts(): Promise<Map<string, number>> {
  const visible = (await visibilityWhere(null)) as Prisma.VideoWhereInput;
  const rows = await prisma.video.groupBy({
    by: ['subCategory'],
    where: { AND: [visible, { status: 'APPROVED', isPublic: true, subCategory: { not: null } }] },
    _count: { _all: true },
  });
  const counts = new Map<string, number>();
  for (const r of rows) {
    const k = (r.subCategory ?? '').trim().toLowerCase();
    if (k) counts.set(k, (counts.get(k) ?? 0) + r._count._all);
  }
  return counts;
}

async function loadState(): Promise<{ settings: TrendingSettings; options: TrendingOption[] }> {
  const [settings, categories, counts] = await Promise.all([loadTrendingSettings(), loadCategoriesSafe(), approvedCounts()]);
  return { settings, options: trendingOptions(categories, counts) };
}

// ── Today ─────────────────────────────────────────────────────────────────────

// On globalThis like the category cache: each route can get its own copy of
// this module, and a save must clear the one cache they all read.
const holder = globalThis as unknown as { trendingTotsCache?: { day: number; at: number; option: TrendingOption | null } | null };
const TTL_MS = 10 * 60_000;

export function invalidateTrendingCache() {
  holder.trendingTotsCache = null;
}

/** Today's option, picked once per day and kept for the rest of it. */
async function resolveToday(state: { settings: TrendingSettings; options: TrendingOption[] }, day: number) {
  const row = await prisma.appSetting.findUnique({ where: { key: TODAY_KEY } });
  let fixed: { day?: number; key?: string } | null = null;
  try { fixed = row ? JSON.parse(row.value) : null; } catch { fixed = null; }
  if (fixed?.day === day && fixed.key) {
    // Still usable: switched on and not emptied since this morning.
    const kept = state.options.find((o) => o.key === fixed!.key && isOptionOn(o, state.settings) && o.videos > 0);
    if (kept) return kept;
  }
  const option = pickForDay(state.options, state.settings, day);
  if (option) {
    const value = JSON.stringify({ day, key: option.key });
    await prisma.appSetting.upsert({ where: { key: TODAY_KEY }, update: { value }, create: { key: TODAY_KEY, value } });
  }
  return option;
}

/** Today's option for the Home feed; null when none has enough videos (the row then shows the overall most watched). */
export async function todayTrendingOption(): Promise<TrendingOption | null> {
  const day = istDay();
  const cache = holder.trendingTotsCache;
  if (cache && cache.day === day && Date.now() - cache.at < TTL_MS) return cache.option;
  const option = await resolveToday(await loadState(), day);
  holder.trendingTotsCache = { day, at: Date.now(), option };
  return option;
}

/** Everything the admin page shows. */
export async function trendingAdminView(): Promise<TrendingView> {
  const day = istDay();
  const state = await loadState();
  const today = await resolveToday(state, day);
  holder.trendingTotsCache = { day, at: Date.now(), option: today };
  return { settings: state.settings, options: state.options, todayKey: today?.key ?? null, day };
}

/** Prisma condition: a video saved under any of the option's names. */
export function optionWhere(option: Pick<TrendingOption, 'names'>): Prisma.VideoWhereInput {
  return { OR: option.names.map((n) => ({ subCategory: { equals: n, mode: 'insensitive' as const } })) };
}
