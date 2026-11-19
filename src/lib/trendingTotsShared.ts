// Trending Tots: the Home row that shows the most watched videos of ONE option
// (sub-category) a day — Dance today, Singing tomorrow, … — set up in
// dashboard → Upload Categories → Home Screen.
//
// Client-safe (the admin page builds its live preview with these): no server
// imports. Server side: lib/trendingTots.ts.

export const TRENDING_TITLE = 'Trending Tots';

/** shuffle: each round shows every option once, in a new random order per round. order: the SuperAdmin's order. */
export type TrendingMode = 'shuffle' | 'order';

export interface TrendingSettings {
  mode: TrendingMode;
  /** Option names in the SuperAdmin's order ('order' mode). Options not listed come after, in category order. */
  order: string[];
  /** Option names left out of the rotation. An option added later is in until it is switched off here. */
  off: string[];
  /** An option needs at least this many approved videos to get a day. */
  minVideos: number;
}

/** One option of the rotation. Options with the same name in several categories are one option. */
export interface TrendingOption {
  /** Lower-case name: the option's id in the rotation. */
  key: string;
  /** Name shown in the app ("Today: Dance"). */
  name: string;
  /** Every stored spelling of it: current and earlier names, normal and Olympiad options. */
  names: string[];
  /** The normal categories that offer it. */
  categories: string[];
  /** Approved videos anyone can see. */
  videos: number;
}

/** What the admin page gets: the settings, the options, and today's option (fixed for the day on the server). */
export interface TrendingView {
  settings: TrendingSettings;
  options: TrendingOption[];
  todayKey: string | null;
  /** Today, as an India-time day number (see istDay). */
  day: number;
}

export const MIN_VIDEOS_LIMITS = { min: 1, max: 15 } as const;

// Catch-all options say nothing as a theme, and Learning / Parenting have their
// own curated rows on Home. The SuperAdmin can switch any of them back on.
export const DEFAULT_OFF = ['Other', 'Others', 'Any Other', 'Any Other Favourite Rhyme', 'Learning', 'Parenting'];

export const DEFAULT_TRENDING_SETTINGS: TrendingSettings = { mode: 'shuffle', order: [], off: DEFAULT_OFF, minVideos: 4 };

const MAX_NAMES = 500;
const MAX_NAME = 60;
const lower = (s: string) => s.trim().toLowerCase();

function cleanNames(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of v) {
    if (typeof x !== 'string') continue;
    const t = x.trim().slice(0, MAX_NAME);
    if (!t || seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    out.push(t);
    if (out.length >= MAX_NAMES) break;
  }
  return out;
}

/** Settings from storage or a request; anything missing or invalid takes its default. */
export function cleanTrendingSettings(raw: unknown): TrendingSettings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const min = Math.round(Number(r.minVideos));
  return {
    mode: r.mode === 'order' ? 'order' : 'shuffle',
    order: cleanNames(r.order),
    // Missing = the defaults; an empty list = the SuperAdmin switched everything on.
    off: Array.isArray(r.off) ? cleanNames(r.off) : [...DEFAULT_OFF],
    minVideos: Number.isFinite(min)
      ? Math.min(MIN_VIDEOS_LIMITS.max, Math.max(MIN_VIDEOS_LIMITS.min, min))
      : DEFAULT_TRENDING_SETTINGS.minVideos,
  };
}

/** Whether a saved list of names mentions this option under any of its names (a rename keeps it matched). */
export function listsOption(list: string[], option: Pick<TrendingOption, 'names'>): boolean {
  const set = new Set(list.map(lower));
  return option.names.some((n) => set.has(lower(n)));
}

export const isOptionOn = (o: TrendingOption, s: TrendingSettings) => !listsOption(s.off, o);

/** Options in the SuperAdmin's order; ones not in it keep their category order, after the listed ones. */
export function orderedOptions(options: TrendingOption[], s: TrendingSettings): TrendingOption[] {
  const pos = new Map(s.order.map((n, i) => [lower(n), i]));
  const rank = (o: TrendingOption) => Math.min(...o.names.map((n) => pos.get(lower(n)) ?? Infinity));
  return options
    .map((o, i) => ({ o, i, r: rank(o) }))
    .sort((a, b) => (a.r === b.r ? a.i - b.i : a.r - b.r))
    .map((x) => x.o);
}

/** The options that can have a day: switched on, with enough videos — in rotation order. */
export function eligibleOptions(options: TrendingOption[], s: TrendingSettings): TrendingOption[] {
  return orderedOptions(options, s).filter((o) => isOptionOn(o, s) && o.videos >= s.minVideos);
}

// ── Days (India time) ─────────────────────────────────────────────────────────

const DAY_MS = 86_400_000;
const IST_OFFSET_MS = 330 * 60_000;

/** Days since 1 Jan 1970 on India's calendar: the row changes at midnight IST. */
export const istDay = (now: number = Date.now()) => Math.floor((now + IST_OFFSET_MS) / DAY_MS);

/** "Sat, 15 Nov" for an India-time day number. */
export function istDayLabel(day: number): string {
  return new Date(day * DAY_MS).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
}

// ── Rotation ──────────────────────────────────────────────────────────────────

function mix(n: number): number {
  let h = (n ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/** The same "random" order for the same seed, on every server and in the admin page. */
function shuffled<T>(items: T[], seed: number): T[] {
  let a = mix(seed);
  const rnd = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * The option key that has this day. 'order': the keys in turn. 'shuffle': the
 * days run in rounds of keys.length days; each round shows every key once in
 * its own random order, and the first day of a round never repeats the last
 * day of the one before.
 */
export function keyForDay(keys: string[], mode: TrendingMode, day: number): string | null {
  const n = keys.length;
  if (n === 0) return null;
  const pos = ((day % n) + n) % n;
  if (mode === 'order') return keys[pos];
  // Shuffle does not depend on the SuperAdmin's order.
  const base = [...keys].sort();
  if (n <= 2) return base[pos]; // plain alternation already never repeats
  const round = Math.floor(day / n);
  const order = shuffled(base, round);
  const prevLast = shuffled(base, round - 1)[n - 1];
  if (order[0] === prevLast) [order[0], order[1]] = [order[1], order[0]];
  return order[pos];
}

/** The option for a day, or null when no option has enough videos (the row then shows the overall most watched). */
export function pickForDay(options: TrendingOption[], s: TrendingSettings, day: number): TrendingOption | null {
  const eligible = eligibleOptions(options, s);
  const key = keyForDay(eligible.map((o) => o.key), s.mode, day);
  return eligible.find((o) => o.key === key) ?? null;
}
