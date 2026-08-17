/**
 * School panel design tokens.
 *
 * The panel is a data-dense admin surface, so colour is treated as information,
 * not decoration: one brand accent carries identity and navigation, and every
 * other hue is reserved for status (registered / pending / error). Anything
 * that used a gradient purely for visual interest is now a flat surface.
 *
 * Import these instead of hardcoding hex values or Tailwind colour utilities so
 * a palette change stays a one-file edit.
 */

/* ── Brand ───────────────────────────────────────────────────────────────── */

export const BRAND = {
  /** Primary accent — links, active nav, focus rings, primary buttons. */
  accent: '#1559C7',
  accentHover: '#1149A3',
  /** Tinted accent backgrounds (selected rows, soft badges). */
  accentSoft: 'rgba(21,89,199,0.08)',
  accentSofter: 'rgba(21,89,199,0.04)',
  /** Deep navy — sidebar only, so the app frame reads as one solid mass. */
  navy: '#0E2A5C',
  navyDeep: '#0A1F45',
} as const;

/* ── Neutrals ────────────────────────────────────────────────────────────── */

export const NEUTRAL = {
  /** App canvas behind the cards. */
  canvas: '#F6F7F9',
  surface: '#FFFFFF',
  /** Table zebra striping / muted panel fills. */
  subtle: '#FAFBFC',
  border: '#E4E8EE',
  borderStrong: '#D3DAE4',
  /** Text ramp. `muted` is the lightest tone that still clears 4.5:1 on white. */
  text: '#111827',
  textSecondary: '#4B5563',
  muted: '#6B7280',
} as const;

/* ── Status ──────────────────────────────────────────────────────────────── */

/**
 * Status colours are the only non-brand hues in the panel. Each is paired with
 * an icon at the call site — colour alone must never carry the meaning.
 */
export const STATUS = {
  success: { fg: '#047857', bg: 'rgba(4,120,87,0.10)' },
  warning: { fg: '#B45309', bg: 'rgba(180,83,9,0.10)' },
  danger: { fg: '#B91C1C', bg: 'rgba(185,28,28,0.10)' },
  info: { fg: '#1559C7', bg: 'rgba(21,89,199,0.10)' },
  neutral: { fg: '#4B5563', bg: 'rgba(75,85,99,0.08)' },
} as const;

export type StatusTone = keyof typeof STATUS;

/* ── Composable class strings ────────────────────────────────────────────── */

/** Standard card: flat white, hairline border, barely-there shadow. */
export const CARD =
  'bg-white rounded-lg border border-[#E4E8EE] shadow-[0_1px_2px_rgba(16,24,40,0.04)]';

/** Card section header — replaces the old per-card gradient strips. */
export const CARD_HEADER =
  'px-4 py-2.5 border-b border-[#E4E8EE] flex items-center gap-2';

/**
 * Section/card title. Sentence case at 600 — not uppercase, not 900. Shares the
 * navy of the page heading so all titles read as one level of the hierarchy.
 */
export const CARD_TITLE = 'text-[13px] font-semibold text-[#0E2A5C]';

/**
 * Vertical rhythm between top-level sections. Deliberately tight: the panel is
 * a working surface, and every 4px of gap is a row of data pushed below the
 * fold on a 768px-tall laptop screen.
 */
export const STACK = 'space-y-3';

/** Field label above an input. */
export const LABEL = 'block text-[12px] font-medium text-[#4B5563] mb-1.5';

/** Visible keyboard focus, applied to every interactive element. */
export const FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1559C7]/40 focus-visible:ring-offset-1';

export const INPUT =
  `w-full rounded-lg border border-[#E4E8EE] bg-white px-3 py-2 text-[13px] text-[#111827] ` +
  `placeholder:text-[#9CA3AF] transition-colors focus:border-[#1559C7] ${FOCUS}`;

export const BTN_PRIMARY =
  `inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#1559C7] px-4 py-2 text-[13px] font-semibold ` +
  `text-white transition-colors hover:bg-[#1149A3] disabled:cursor-not-allowed disabled:opacity-50 disabled:pointer-events-none ${FOCUS}`;

export const BTN_SECONDARY =
  `inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#D3DAE4] bg-white px-4 py-2 ` +
  `text-[13px] font-semibold text-[#374151] transition-colors hover:bg-[#F6F7F9] ` +
  `disabled:cursor-not-allowed disabled:opacity-50 disabled:pointer-events-none ${FOCUS}`;

/**
 * Low-emphasis toolbar action (Export CSV, Expand all). Smaller and lighter
 * than BTN_SECONDARY, which stays full-size because it sits beside a primary
 * button in dialogs and has to balance it.
 */
export const BTN_SUBTLE =
  `inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-md bg-[#F3F5F8] px-2.5 py-1.5 text-[12px] ` +
  `font-medium text-[#4B5563] transition-colors hover:bg-[#E7EBF1] hover:text-[#111827] ` +
  `disabled:cursor-not-allowed disabled:opacity-45 disabled:pointer-events-none ${FOCUS}`;

/** Small square icon-only button. Always needs an aria-label at the call site. */
export const BTN_ICON =
  `inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-[#E4E8EE] bg-white ` +
  `text-[#6B7280] transition-colors hover:bg-[#F6F7F9] hover:text-[#111827] ${FOCUS}`;

/* ── Tables ──────────────────────────────────────────────────────────────── */

/**
 * Tables are fully gridlined — a border on every cell, not just row rules.
 * At this density the vertical lines are what let the eye track a column
 * across a wide row, so they carry real work and are not decoration.
 *
 * Put `TABLE` on the <table>, `TH` on header cells, `TD` on body cells, and
 * `TR` on body rows. Rows are 32px to keep the first screen full.
 */
export const TABLE = 'w-full border-collapse text-[13px]';

export const TH =
  'border border-[#E4E8EE] bg-[#F3F5F8] px-3 py-2 text-left text-[11px] font-semibold ' +
  'uppercase tracking-wide text-[#4B5563] whitespace-nowrap';

export const TD = 'border border-[#E4E8EE] px-3 py-1.5 text-[13px] text-[#374151] align-middle';

export const TR = 'hover:bg-[#1559C7]/[0.035] transition-colors';

/** Sticky header cell for long scrolling tables. */
export const TH_STICKY = `${TH} sticky top-0 z-10`;

/* ── Avatars ─────────────────────────────────────────────────────────────── */

/**
 * Muted, low-chroma tints for student initials. These keep lists feeling human
 * without reintroducing a rainbow — pick by index, not by meaning.
 */
export const AVATAR_TINTS = [
  'bg-[#E8EEF9] text-[#1F4E9C]',
  'bg-[#E7F1EC] text-[#1F6B4F]',
  'bg-[#EFEBF7] text-[#4C3E86]',
  'bg-[#FBEDE8] text-[#9C4A2C]',
  'bg-[#FAF0DF] text-[#8A5B12]',
] as const;

export const avatarTint = (i: number) => AVATAR_TINTS[i % AVATAR_TINTS.length];

/** Two-letter initials for an avatar chip. */
export const initialsOf = (name: string) =>
  (name || '?')
    .trim()
    .split(/\s+/)
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
