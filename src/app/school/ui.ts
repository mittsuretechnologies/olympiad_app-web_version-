/**
 * School panel design tokens.
 *
 * Direction: a calm, institutional working surface. Brand colour (mittmee blue)
 * marks what is interactive or selected; status hues are reserved for status;
 * everything else is a tight ramp of cool neutrals. Depth comes from crisp
 * borders and one soft shadow level, not from colour or gradients.
 *
 * Import these instead of hardcoding hex values or Tailwind colour utilities so
 * a palette change stays a one-file edit.
 */

/* ── Brand ───────────────────────────────────────────────────────────────── */

export const BRAND = {
  /** Primary accent — links, active nav, focus rings, primary buttons. */
  accent: '#1559C7',
  accentHover: '#0F4AAE',
  /** Tinted accent backgrounds (selected rows, soft badges). */
  accentSoft: 'rgba(21,89,199,0.08)',
  accentSofter: 'rgba(21,89,199,0.04)',
  /** Ink navy — page titles and the strongest text. */
  navy: '#0B1B33',
  navyDeep: '#071226',
  /** mittmee green — brand mark and positive progress. */
  green: '#2E9E46',
} as const;

/* ── Neutrals ────────────────────────────────────────────────────────────── */

export const NEUTRAL = {
  /** App canvas behind the cards. */
  canvas: '#F4F5F7',
  surface: '#FFFFFF',
  /** Table headers / muted panel fills. */
  subtle: '#F8F9FB',
  border: '#E6E8EC',
  borderStrong: '#D2D7DF',
  /** Text ramp. `muted` is the lightest tone that still clears 4.5:1 on white. */
  text: '#0F1B2D',
  textSecondary: '#475265',
  muted: '#677285',
} as const;

/* ── Status ──────────────────────────────────────────────────────────────── */

/**
 * Status colours are the only non-brand hues in the panel. Each is paired with
 * an icon or a dot plus text at the call site — colour alone must never carry
 * the meaning.
 */
export const STATUS = {
  success: { fg: '#1D7A3A', bg: 'rgba(46,158,70,0.10)' },
  warning: { fg: '#A1530A', bg: 'rgba(217,119,6,0.10)' },
  danger: { fg: '#B42323', bg: 'rgba(220,38,38,0.08)' },
  info: { fg: '#1559C7', bg: 'rgba(21,89,199,0.08)' },
  neutral: { fg: '#475265', bg: 'rgba(71,82,101,0.08)' },
} as const;

export type StatusTone = keyof typeof STATUS;

/* ── Composable class strings ────────────────────────────────────────────── */

/** Standard card: white, crisp border, one soft shadow level. Tight corners and
 *  a thin border keep it reading as a working surface, not a marketing tile. */
export const CARD =
  'bg-white rounded-lg border border-[#E6E8EC] shadow-[0_1px_2px_rgba(15,27,45,0.04)]';

/** Card section header. */
export const CARD_HEADER =
  'px-3.5 py-2.5 border-b border-[#EEF0F3] flex items-center gap-2';

/** Section/card title. Sentence case, ink, one step below the page title. */
export const CARD_TITLE = 'text-[13px] font-semibold tracking-[-0.005em] text-[#0F1B2D]';

/** Vertical rhythm between top-level sections. Deliberately tight — this is a
 *  working surface, and every extra pixel of gap pushes a row of data below
 *  the fold on a laptop screen. */
export const STACK = 'space-y-3';

/** Field label above an input. */
export const LABEL = 'block text-[12.5px] font-medium text-[#2A3446] mb-1.5';

/** Visible keyboard focus, applied to every interactive element. */
export const FOCUS =
  'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#1559C7]/25';

export const INPUT =
  `w-full rounded-lg border border-[#D9DDE4] bg-white px-3 py-2 text-[13px] text-[#0F1B2D] ` +
  `shadow-[0_1px_1px_rgba(15,27,45,0.03)] placeholder:text-[#98A1B2] transition-[border-color,box-shadow] ` +
  `hover:border-[#C5CBD5] focus:border-[#1559C7] focus:outline-none focus:ring-[3px] focus:ring-[#1559C7]/15`;

export const BTN_PRIMARY =
  `inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#1559C7] px-3.5 py-2 text-[13px] font-semibold ` +
  `text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_1px_2px_rgba(15,27,45,0.16)] transition-colors ` +
  `hover:bg-[#0F4AAE] active:bg-[#0D3F95] disabled:cursor-not-allowed disabled:opacity-50 disabled:pointer-events-none ${FOCUS}`;

export const BTN_SECONDARY =
  `inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#D9DDE4] bg-white px-3.5 py-2 ` +
  `text-[13px] font-semibold text-[#2A3446] shadow-[0_1px_1px_rgba(15,27,45,0.04)] transition-colors ` +
  `hover:border-[#C5CBD5] hover:bg-[#F8F9FB] hover:text-[#0F1B2D] ` +
  `disabled:cursor-not-allowed disabled:opacity-50 disabled:pointer-events-none ${FOCUS}`;

/** Low-emphasis toolbar action (Export CSV, Expand all). */
export const BTN_SUBTLE =
  `inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-transparent px-2.5 py-1.5 text-[12.5px] ` +
  `font-medium text-[#475265] transition-colors hover:border-[#E6E8EC] hover:bg-white hover:text-[#0F1B2D] ` +
  `disabled:cursor-not-allowed disabled:opacity-45 disabled:pointer-events-none ${FOCUS}`;

/** Small square icon-only button. Always needs an aria-label at the call site. */
export const BTN_ICON =
  `inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-[#E6E8EC] bg-white ` +
  `text-[#677285] transition-colors hover:border-[#D2D7DF] hover:bg-[#F8F9FB] hover:text-[#0F1B2D] ${FOCUS}`;

/* ── Tables ──────────────────────────────────────────────────────────────── */

/**
 * Tables use horizontal rules only: rows read as lines of a register, and the
 * header sits on a quiet tinted band in sentence case. Numbers are tabular so
 * columns of counts line up digit for digit.
 *
 * Put `TABLE` on the <table>, `TH` on header cells, `TD` on body cells, and
 * `TR` on body rows.
 */
export const TABLE = 'w-full border-collapse text-[13px] tabular-nums';

export const TH =
  'border-b border-[#E6E8EC] bg-[#F8F9FB] px-3 py-2.5 text-left text-[12px] font-medium ' +
  'text-[#556072] whitespace-nowrap';

export const TD = 'border-b border-[#EEF0F3] px-3 py-2.5 text-[13px] text-[#2A3446] align-middle';

export const TR = 'hover:bg-[#F6F8FC] transition-colors';

/** Sticky header cell for long scrolling tables. */
export const TH_STICKY = `${TH} sticky top-0 z-10`;

/* ── Avatars ─────────────────────────────────────────────────────────────── */

/**
 * Muted, low-chroma tints for student initials. These keep lists feeling human
 * without reintroducing a rainbow — pick by index, not by meaning.
 */
export const AVATAR_TINTS = [
  'bg-[#E9F0FB] text-[#1A4E9E]',
  'bg-[#E8F4EC] text-[#1D6B3A]',
  'bg-[#EFEDF8] text-[#4B3F8A]',
  'bg-[#FBEEE9] text-[#9A4A2E]',
  'bg-[#FAF2E2] text-[#875C14]',
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
