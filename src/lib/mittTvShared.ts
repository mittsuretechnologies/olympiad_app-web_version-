// MittTV: choices, defaults and checks shared by the dashboard page (browser)
// and the API (src/lib/mittTv.ts). Client-safe: no server imports.

export const MITTTV_AUDIENCES = [
  { key: 'NORMAL', label: 'General User' },
  { key: 'OLYMPIAD_STUDENT', label: 'Olympiad Student' },
  { key: 'GENERAL_SCHOOL', label: 'General School' },
  { key: 'OLYMPIAD_SCHOOL', label: 'Olympiad School' },
] as const;
export type MittTvAudience = (typeof MITTTV_AUDIENCES)[number]['key'];

/**
 * The kinds of section the MittTV screen is built from.
 * - BANNER and CONTINUE exist once each and can't be deleted (only hidden,
 *   renamed, and — Continue Watching — moved). The banner is always on top.
 * - CURATED rows hold the videos the admin picks (Stories, Rhymes…).
 * - MOST_WATCHED and NEW fill themselves.
 * A row kind the server doesn't know (e.g. one added for the class & subject
 * platform later) is skipped by older servers and older apps alike.
 */
export const ROW_KINDS = [
  { key: 'BANNER', label: 'Big banner', hint: 'The sliding banner at the top of MittTV.', single: true },
  { key: 'CONTINUE', label: 'Continue Watching', hint: 'Each user sees the videos they stopped half-way. Fills itself.', single: true },
  { key: 'CURATED', label: 'Hand-picked videos', hint: 'You choose the videos and their order (Stories, Rhymes…).', single: false },
  { key: 'MOST_WATCHED', label: 'Most watched (automatic)', hint: 'Videos with the most views in the last few days.', single: false },
  { key: 'NEW', label: 'Newest videos (automatic)', hint: 'The latest videos you added, newest first.', single: false },
] as const;
export type RowKind = (typeof ROW_KINDS)[number]['key'];
export const ROW_KIND_KEYS = ROW_KINDS.map((k) => k.key) as RowKind[];
/** Kinds the admin can add more of. */
export const CREATABLE_KINDS: RowKind[] = ['CURATED', 'MOST_WATCHED', 'NEW'];
/** Kinds whose videos are a list kept in MittTvRowItem. */
export const PICKED_KINDS: RowKind[] = ['BANNER', 'CURATED'];

export const ROW_STYLES = [
  { key: 'LANDSCAPE', label: 'Wide cards' },
  { key: 'POSTER', label: 'Tall posters' },
  { key: 'LARGE', label: 'Big wide cards' },
  { key: 'TOP10', label: 'Top 10 with numbers' },
] as const;
export type RowStyle = (typeof ROW_STYLES)[number]['key'];

export const BANNER_MODES = [
  { key: 'MIXED', label: 'Pinned first, then most watched', hint: 'Your pinned videos, then the most watched ones fill the rest.' },
  { key: 'AUTO', label: 'Most watched only', hint: 'Picks itself from views in the last few days.' },
  { key: 'MANUAL', label: 'Pinned only', hint: 'Only the videos you pin, in your order.' },
] as const;
export type BannerMode = (typeof BANNER_MODES)[number]['key'];

/**
 * How a row's "See all" screen lays out its videos. AUTO = follows the row's
 * card style (tall posters → 3 a line, the rest → 2 wide a line). An app that
 * doesn't know a layout uses AUTO.
 */
export const SEE_ALL_LAYOUTS = [
  { key: 'AUTO', label: 'Same as the row', hint: 'Tall posters 3 a line, other styles 2 wide a line.' },
  { key: 'GRID2', label: '2 wide thumbnails', hint: 'Two 16:9 thumbnails a line.' },
  { key: 'GRID3', label: '3 tall posters', hint: 'Three 2:3 posters a line.' },
  { key: 'LIST', label: 'List with details', hint: 'Thumbnail on the left, title and description on the right.' },
  { key: 'BIG', label: 'Big cards', hint: 'One full-width card a line.' },
] as const;
export type SeeAllLayout = (typeof SEE_ALL_LAYOUTS)[number]['key'];
/** Row kinds that can have more videos than they show, so a "See all" screen. */
export const SEE_ALL_KINDS: RowKind[] = ['CONTINUE', 'CURATED', 'NEW'];

export function isSeeAllLayout(v: unknown): v is SeeAllLayout {
  return typeof v === 'string' && SEE_ALL_LAYOUTS.some((l) => l.key === v);
}

export const MITTTV_LIMITS = {
  title: 120,
  description: 1000,
  tags: 200,
  rowTitle: 60,
  rowSubtitle: 80,
  buttonLabel: 14,
  screenTitle: 30,
  /** Videos one hand-picked row or the banner can hold. */
  rowItems: 100,
  /** Extra "label: value" lines on a video's details page. */
  details: 8,
  detailLabel: 30,
  detailValue: 80,
  /** Free-text paragraphs above Play on the details page. */
  notes: 4,
  noteText: 500,
  /** Longest search the app can send. */
  search: 60,
} as const;

/** One extra line on a video's details page in the app, e.g. Language: Hindi. */
export interface VideoDetail {
  label: string;
  value: string;
}

/** The admin's extra details for a video: trimmed, empty lines dropped, at most MITTTV_LIMITS.details. */
export function cleanVideoDetails(raw: unknown): VideoDetail[] {
  if (!Array.isArray(raw)) return [];
  const out: VideoDetail[] = [];
  for (const d of raw) {
    const label = text(d?.label, MITTTV_LIMITS.detailLabel);
    const value = text(d?.value, MITTTV_LIMITS.detailValue);
    if (label && value) out.push({ label, value });
    if (out.length >= MITTTV_LIMITS.details) break;
  }
  return out;
}

/** The extra details stored in a video's meta JSON. */
export function videoDetailsFromMeta(meta: unknown): VideoDetail[] {
  return cleanVideoDetails(meta && typeof meta === 'object' ? (meta as any).details : null);
}

/**
 * The admin's free-text paragraphs for a video (shown above Play on the app's
 * details page): trimmed, line breaks kept (at most one blank line in a row),
 * empty ones dropped, at most MITTTV_LIMITS.notes.
 */
export function cleanVideoNotes(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const n of raw) {
    const t = typeof n === 'string'
      ? n.replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, MITTTV_LIMITS.noteText)
      : '';
    if (t) out.push(t);
    if (out.length >= MITTTV_LIMITS.notes) break;
  }
  return out;
}

/** The free-text paragraphs stored in a video's meta JSON. */
export function videoNotesFromMeta(meta: unknown): string[] {
  return cleanVideoNotes(meta && typeof meta === 'object' ? (meta as any).notes : null);
}

/** Defaults for the automatic parts, and the bounds the admin can set. */
export const ROW_DEFAULTS = {
  bannerLimit: 6,
  /** How many videos a row shows on the MittTV screen before "See all". */
  rowLimit: 20,
  top10Limit: 10,
  /** Most watched looks at views from this many days. */
  days: 7,
} as const;
export const LIMIT_RANGE = { min: 1, max: 50 } as const;
export const DAYS_RANGE = { min: 1, max: 90 } as const;

export interface MittTvSettings {
  /** Master switch: off = no MittTV button and the screen answers "not available". */
  enabled: boolean;
  /** Who sees MittTV. */
  audiences: MittTvAudience[];
  /** Text on the floating button on Home. */
  buttonLabel: string;
  /** Title at the top of the MittTV screen. */
  screenTitle: string;
  /** The search button at the top right of the MittTV screen. */
  searchEnabled: boolean;
}

export const DEFAULT_SETTINGS: MittTvSettings = {
  // Off until the SuperAdmin has added videos and switches it on.
  enabled: false,
  audiences: MITTTV_AUDIENCES.map((a) => a.key),
  buttonLabel: 'MittTV',
  screenTitle: 'MittTV',
  searchEnabled: true,
};

/**
 * Banner: { mode, limit, days }. Most watched: { limit, days }.
 * Hand-picked, Newest, Continue Watching: { limit, seeAllLayout }.
 */
export interface RowSettings {
  mode?: BannerMode;
  limit?: number;
  days?: number;
  seeAllLayout?: SeeAllLayout;
}

const clampInt = (v: unknown, lo: number, hi: number, fallback: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback;
};

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** Merges what the page sent into the current settings. Returns the settings, or an error message. */
export function cleanSettings(raw: any, current: MittTvSettings = DEFAULT_SETTINGS): MittTvSettings | string {
  const next: MittTvSettings = { ...current };
  if (raw && 'enabled' in raw) next.enabled = !!raw.enabled;
  if (raw && 'audiences' in raw) {
    const valid = new Set<string>(MITTTV_AUDIENCES.map((a) => a.key));
    const list = Array.isArray(raw.audiences) ? raw.audiences.filter((a: unknown) => typeof a === 'string' && valid.has(a)) : [];
    if (list.length === 0) return 'Pick at least one type of user who can see MittTV.';
    next.audiences = [...new Set(list)] as MittTvAudience[];
  }
  if (raw && 'buttonLabel' in raw) {
    const label = text(raw.buttonLabel, MITTTV_LIMITS.buttonLabel);
    if (!label) return 'The button needs a label.';
    next.buttonLabel = label;
  }
  if (raw && 'screenTitle' in raw) {
    const title = text(raw.screenTitle, MITTTV_LIMITS.screenTitle);
    if (!title) return 'The screen needs a title.';
    next.screenTitle = title;
  }
  if (raw && 'searchEnabled' in raw) next.searchEnabled = !!raw.searchEnabled;
  return next;
}

/** Reads stored settings JSON, falling back to the defaults for anything missing or broken. */
export function parseSettings(json: string | null | undefined): MittTvSettings {
  if (!json) return { ...DEFAULT_SETTINGS };
  try {
    const parsed = cleanSettings(JSON.parse(json), DEFAULT_SETTINGS);
    return typeof parsed === 'string' ? { ...DEFAULT_SETTINGS } : parsed;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/** The settings a row of this kind keeps, cleaned and with defaults filled in. */
export function cleanRowSettings(kind: string, raw: any): RowSettings {
  const r = raw && typeof raw === 'object' ? raw : {};
  switch (kind) {
    case 'BANNER':
      return {
        mode: BANNER_MODES.some((m) => m.key === r.mode) ? r.mode : 'MIXED',
        limit: clampInt(r.limit, LIMIT_RANGE.min, 12, ROW_DEFAULTS.bannerLimit),
        days: clampInt(r.days, DAYS_RANGE.min, DAYS_RANGE.max, ROW_DEFAULTS.days),
      };
    case 'MOST_WATCHED':
      return {
        limit: clampInt(r.limit, LIMIT_RANGE.min, LIMIT_RANGE.max, ROW_DEFAULTS.top10Limit),
        days: clampInt(r.days, DAYS_RANGE.min, DAYS_RANGE.max, ROW_DEFAULTS.days),
      };
    case 'NEW':
    case 'CURATED':
    case 'CONTINUE':
      return {
        limit: clampInt(r.limit, LIMIT_RANGE.min, LIMIT_RANGE.max, ROW_DEFAULTS.rowLimit),
        seeAllLayout: isSeeAllLayout(r.seeAllLayout) ? r.seeAllLayout : 'AUTO',
      };
    default:
      return {};
  }
}

export function isRowKind(v: unknown): v is RowKind {
  return typeof v === 'string' && (ROW_KIND_KEYS as string[]).includes(v);
}

export function isRowStyle(v: unknown): v is RowStyle {
  return typeof v === 'string' && ROW_STYLES.some((s) => s.key === v);
}

export function cleanRowTitle(v: unknown): string {
  return text(v, MITTTV_LIMITS.rowTitle);
}

export function cleanRowSubtitle(v: unknown): string {
  return text(v, MITTTV_LIMITS.rowSubtitle);
}

/** "1:05:09" / "4:07" for a length in seconds; '' when unknown. */
export function formatDuration(sec: number): string {
  if (!sec || sec < 1) return '';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const mm = h ? String(m).padStart(2, '0') : String(m);
  return `${h ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`;
}
