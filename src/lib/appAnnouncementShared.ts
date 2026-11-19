// SuperAdmin → App Notifications: limits, choices and checks shared by the
// compose page (browser) and the API. Client-safe: no server imports.

export const ANNOUNCEMENT_LIMITS = { title: 80, message: 500 } as const;

export const ANNOUNCEMENT_TYPES = [
  { key: 'NORMAL', label: 'General User' },
  { key: 'OLYMPIAD_STUDENT', label: 'Olympiad Student' },
  { key: 'GENERAL_SCHOOL', label: 'General School' },
  { key: 'OLYMPIAD_SCHOOL', label: 'Olympiad School' },
] as const;
export type AnnouncementType = (typeof ANNOUNCEMENT_TYPES)[number]['key'];

/** Olympiad classes (single-letter codes in the Olympiad ID). */
export const ANNOUNCEMENT_CLASSES = [
  { code: 'P', label: 'PG' },
  { code: 'N', label: 'Nursery' },
  { code: 'L', label: 'LKG' },
  { code: 'U', label: 'UKG' },
] as const;

export interface AnnouncementFilters {
  types: AnnouncementType[];
  /** Empty = every state. */
  states: string[];
  /** Empty = every district (of the chosen states). */
  districts: string[];
  /** Olympiad students only; empty = every class. */
  classes: string[];
}

/** Screens the app can open from a notification (Components/utils/openAppLink.js). */
export const APP_LINK_OPTIONS = [
  { value: '', label: 'Nothing (just the message)' },
  { value: 'app://Upload', label: 'Upload screen' },
  { value: 'app://Reels', label: 'Qlips (Reels)' },
  { value: 'app://Search', label: 'Search' },
  { value: 'app://Games', label: 'Games' },
  { value: 'app://Coins', label: 'My Coins' },
  { value: 'app://Profile', label: 'Their profile' },
  { value: 'app://MySchool', label: 'My School' },
  { value: 'url', label: 'A website link…' },
] as const;

/** A link the app can open: one of its screens, or a website. Empty = none. */
export function linkProblem(link: string): string | null {
  if (!link) return null;
  if (/^app:\/\/[A-Za-z]+(\?.*)?$/.test(link)) return null;
  if (/^https?:\/\/[^\s]+\.[^\s]+$/i.test(link)) return null;
  return 'The link must be an app screen or a website starting with https://';
}

/** Cleans what the page sent. Returns the filters, or an error message. */
export function cleanFilters(raw: any): AnnouncementFilters | string {
  const list = (v: unknown) =>
    Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string' && !!x.trim()).map((x) => x.trim()))] : [];
  const valid = new Set<string>(ANNOUNCEMENT_TYPES.map((t) => t.key));
  const types = list(raw?.types).filter((t) => valid.has(t)) as AnnouncementType[];
  if (types.length === 0) return 'Pick at least one type of user.';
  const classCodes = new Set<string>(ANNOUNCEMENT_CLASSES.map((c) => c.code));
  return {
    types,
    states: list(raw?.states).slice(0, 50),
    districts: list(raw?.districts).slice(0, 200),
    classes: list(raw?.classes).map((c) => c.toUpperCase()).filter((c) => classCodes.has(c)),
  };
}
