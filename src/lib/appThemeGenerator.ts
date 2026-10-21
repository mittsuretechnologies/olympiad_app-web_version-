import type { AppThemeConfigInput } from '@/lib/appThemeConfig';

// "Custom festival" — builds a whole theme (festive top, header decoration,
// splash, tiles, decorations) from a few answers: the festival's name, one
// colour, an emoji and an artwork style. Used for festivals without a preset
// (Lohri, Pongal, Baisakhi, Guru Purab, a school's annual day …). The result
// is an ordinary config — every field stays editable in the tabs afterwards.

export type CustomStyle = 'vibrant' | 'soft' | 'night';

export interface CustomFestivalInput {
  name: string;           // e.g. "Lohri"
  kicker: string;         // small line above the title, e.g. HAPPY
  emoji: string;          // e.g. 🔥
  color: string;          // main festival colour, #RRGGBB
  art: string;            // splashArt id, or 'none'
  style: CustomStyle;     // bright band / pastel band / deep night band
  subtitle: string;       // splash line; blank = generated
  tiles: string;          // comma-separated search words, e.g. "bhangra, songs"
  decor: string;          // floating decorations, emoji separated by commas/spaces; blank = festival emoji + sparkles
  effect: 'static' | 'fall';
  emojiPlacement: 'both' | 'left' | 'right' | 'above' | 'none';
  align: 'center' | 'left' | 'right';
}

export const CUSTOM_STYLES: [CustomStyle, string, string][] = [
  ['vibrant', 'Vibrant', 'Bold festival colour'],
  ['soft', 'Soft', 'Light pastel band'],
  ['night', 'Night', 'Deep, glowing band'],
];

// Quick colour picks for the generator.
export const CUSTOM_SWATCHES = [
  '#FF8A1F', '#E64980', '#7048E8', '#1C7ED6', '#0C8599', '#2F9E44', '#F59F00', '#C92A2A', '#5F3DC4', '#D9480F',
];

export const CUSTOM_DEFAULTS: CustomFestivalInput = {
  name: '', kicker: 'HAPPY', emoji: '🎉', color: '#FF8A1F', art: 'celebration', style: 'vibrant', subtitle: '', tiles: 'songs, dance, art',
  decor: '', effect: 'static', emojiPlacement: 'both', align: 'center',
};

// ── Colour maths ────────────────────────────────────────────────────────────
function toRgb(hex: string): [number, number, number] {
  const v = parseInt(hex.replace('#', '').slice(0, 6), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
const toHex = (r: number, g: number, b: number) =>
  `#${[r, g, b].map((x) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, '0')).join('')}`.toUpperCase();

export function mix(a: string, b: string, t: number) {
  const [r1, g1, b1] = toRgb(a), [r2, g2, b2] = toRgb(b);
  return toHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}

// WCAG contrast ratio between two colours (1–21).
export function contrastRatio(a: string, b: string) {
  const lum = (hex: string) => {
    const ch = toRgb(hex).map((c) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export function isLight(hex: string) {
  const [r, g, b] = toRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62;
}

// Turn the hue by `deg`, keeping saturation and lightness — gives matching
// companion colours for stripes and tiles.
function rotate(hex: string, deg: number) {
  const [r, g, b] = toRgb(hex).map((x) => x / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  let h = 0;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (h * 60 + deg + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r1, g1, b1] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return toHex((r1 + m) * 255, (g1 + m) * 255, (b1 + m) * 255);
}

const TILE_EMOJI: Record<string, string> = {
  song: '🎶', songs: '🎶', music: '🎵', dance: '💃', art: '🎨', drawing: '🖍️', craft: '✂️', speech: '🎤',
  poem: '📝', story: '📖', bhajan: '🪔', rangoli: '🎨', cooking: '🍳', quiz: '🧠', science: '🔬', sports: '🏅',
};
const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());

// "🔥 ✨, 🪁" or "🔥✨🪁" → ['🔥', '✨', '🪁'] (one entry per visible emoji).
function splitEmoji(text: string): string[] {
  const parts = text.split(/[,\s]+/).filter(Boolean);
  const Seg = (Intl as unknown as { Segmenter?: new (l?: string, o?: { granularity: string }) => { segment: (s: string) => Iterable<{ segment: string }> } }).Segmenter;
  if (!Seg) return parts;
  const seg = new Seg(undefined, { granularity: 'grapheme' });
  return parts.flatMap((p) => [...seg.segment(p)].map((g) => g.segment)).filter((g) => g.trim());
}

// ── Generator ───────────────────────────────────────────────────────────────
export function generateCustomTheme(input: CustomFestivalInput): AppThemeConfigInput {
  const name = input.name.trim().slice(0, 28) || 'Festival';
  // Emoji only — typed words would fail the decoration check on save.
  const rawEmoji = input.emoji.trim().slice(0, 16);
  const emoji = /[A-Za-z0-9<>&"']/.test(rawEmoji) ? '' : rawEmoji;
  const kicker = input.kicker.trim().toUpperCase().slice(0, 24);
  const base = /^#[0-9a-fA-F]{6}$/.test(input.color) ? input.color.toUpperCase() : CUSTOM_DEFAULTS.color;
  const art = input.art || 'none';

  // Band + splash per style.
  const band: [string, string] = input.style === 'soft'
    ? [mix(base, '#FFFFFF', 0.35), mix(base, '#FFFFFF', 0.7)]
    : input.style === 'night'
      ? [mix(base, '#0B0720', 0.55), mix(base, '#0B0720', 0.15)]
      : [base, mix(base, '#FFFFFF', 0.5)];
  const bandLight = isLight(band[0]);
  const splashBg = input.style === 'soft'
    ? [mix(base, '#FFFFFF', 0.45), mix(base, '#FFFFFF', 0.75), '#FFFFFF']
    : input.style === 'night'
      ? [mix(base, '#0B0720', 0.45), mix(base, '#0B0720', 0.7), '#0B0720']
      : [base, mix(base, '#000000', 0.2), mix(base, '#000000', 0.45)];
  const splashLight = isLight(splashBg[0]);
  const deep = mix(base, '#000000', 0.6);
  // Accent (tagline pill, dots) must carry white text — darken light colours.
  const accent = isLight(base) ? mix(base, '#000000', 0.4) : base;
  const gold = '#FFD43B';

  const companionA = rotate(base, 40), companionB = rotate(base, -40), companionC = rotate(base, 180);
  const divider = [base, companionA, gold, companionB, base];

  const words = input.tiles.split(',').map((w) => w.trim()).filter(Boolean).slice(0, 5);
  const tintOf = [companionA, companionB, base, companionC, gold];
  const tiles = [
    ...words.map((w, i) => ({
      label: titleCase(w).slice(0, 24),
      emoji: TILE_EMOJI[w.toLowerCase()] ?? (i === 0 && emoji ? emoji : '✨'),
      linkUrl: `app://Search?q=${encodeURIComponent(w.toLowerCase())}`,
      color: mix(tintOf[i % tintOf.length], '#FFFFFF', 0.86),
    })),
    { label: 'Upload Yours', emoji: '📹', linkUrl: 'app://Upload', color: '#EBFBEE' },
  ];

  // Own decorations: emoji only (words would fail the check on save), max 6.
  const ownDecor = splitEmoji(input.decor || '').filter((d) => !/[A-Za-z0-9<>&"']/.test(d) && d.length <= 16).slice(0, 6);
  const decorIcons = ownDecor.length ? ownDecor : [...(emoji ? [emoji] : []), 'sparkles', 'star'];

  const greet0 = kicker ? `${titleCase(kicker.toLowerCase())} ${name}` : name;
  const greet = `${greet0} from Mittmee`.length + 3 <= 60 ? `${greet0} from Mittmee` : greet0;
  return {
    colors: { accent, accentText: '#FFFFFF', divider },
    header: { tagline: `${greet}${emoji ? ` ${emoji}` : ''}`.slice(0, 60), taglineIcon: 'sparkles' },
    decor: {
      icons: decorIcons,
      colors: [accent, gold, mix(base, '#FFFFFF', 0.5)],
      effect: input.effect === 'fall' ? 'fall' : 'static', density: 'medium',
    },
    hero: {
      enabled: true,
      colors: band,
      textTone: bandLight ? 'dark' : 'light',
      kicker, title: name, emoji,
      emojiPlacement: input.emojiPlacement || 'both',
      align: input.align || 'center',
      textColor: bandLight ? deep : (input.style === 'night' ? gold : '#FFFFFF'),
      bunting: true,
      headerArt: art,
      showTiles: false,
      tilesTitle: 'Festive Picks',
      tiles,
    },
    splash: {
      enabled: true, art, bg: splashBg,
      textColor: splashLight ? deep : (input.style === 'night' ? gold : '#FFFFFF'),
      kicker, title: name,
      subtitle: (input.subtitle.trim() || `Celebrate ${name} with your talent`).slice(0, 80),
      decor: decorIcons,
      decorColors: [gold, '#FFFFFF'],
      animation: 'pop',
    },
  };
}

// "Match everything to the background" (Page look tab): from the page
// background gradient, the colours that should follow it — header (when
// scrolled), page text, section headings + "See all", bottom tab bar, logo
// text and status bar — so a coloured page still reads as one design and
// stays readable. Applied once on click; every field stays editable.
export function matchColorsToBackground(bg: string[]) {
  const first = bg[0];
  const last = bg[bg.length - 1];
  const avg = bg.reduce((acc, c) => mix(acc, c, 0.5), first);
  // Text: whichever of white / deep ink reads better against EVERY stop of
  // the gradient (worst-case contrast), not just its average.
  const ink = mix(avg, '#000000', 0.85);
  const worst = (t: string) => Math.min(...bg.map((c) => contrastRatio(t, c)));
  const light = worst(ink) >= worst('#FFFFFF');
  const text = light ? ink : '#FFFFFF';
  // Tab bar: a deeper version of the page, darkened until its white icons
  // and labels pass 4.5:1.
  let k = 0.25;
  let barA = mix(first, '#000000', k);
  let barB = mix(last, '#000000', k + 0.1);
  while (k < 0.8 && Math.min(contrastRatio('#FFFFFF', barA), contrastRatio('#FFFFFF', barB)) < 4.5) {
    k += 0.05;
    barA = mix(first, '#000000', k);
    barB = mix(last, '#000000', k + 0.1);
  }
  return {
    header: light ? bg.map((c) => mix(c, '#FFFFFF', 0.35)) : bg.map((c) => mix(c, '#000000', 0.15)),
    text,
    sectionTitle: text,
    sectionAccent: light ? mix(avg, '#000000', 0.5) : mix(avg, '#FFFFFF', 0.7),
    tabBar: [barA, barB],
    tabBarIcon: mix(barA, '#000000', 0.2),
    statusBar: (light ? 'dark' : 'light') as 'dark' | 'light',
    // The green/blue logo can't be read on a dark page.
    brand: light ? ['#1FAE8E', '#3E82E0'] : ['#FFFFFF', '#FFFFFF'],
  };
}

// "Surprise me": a random colour, artwork and style for the generator.
export function surpriseCustom(prev: CustomFestivalInput, artIds: string[]): CustomFestivalInput {
  const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];
  return {
    ...prev,
    color: pick(CUSTOM_SWATCHES.filter((c) => c !== prev.color)),
    art: pick(artIds.filter((a) => a !== 'everyday')),
    style: pick(CUSTOM_STYLES.map(([s]) => s)),
  };
}
