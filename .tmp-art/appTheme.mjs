// The home screen's look, as set by the SuperAdmin in Dashboard → App Theme &
// Festivals (GET /api/app/theme). `resolveAppTheme(null)` is the app's own
// built-in look — every value below is what HomeScreen hard-coded before
// themes existed, so with no live theme nothing changes.
//
// The server already validates and fills defaults, but this merges
// field-by-field again and ignores anything malformed: a bad or newer-shaped
// payload can degrade one value, never crash the home screen.

const API_BASE = 'http://10.0.2.2:3000/api';
import { SPLASH_ART } from './splashArt.mjs';

// Ionicons the dashboard can choose (keep in sync with THEME_ICONS in the web
// project's src/lib/appThemeConfig.ts). Any other decoration is an emoji.
export const THEME_ICONS = new Set([
  'star', 'star-outline', 'sparkles', 'sparkles-outline', 'heart', 'heart-outline',
  'flower', 'flower-outline', 'rose', 'leaf', 'snow', 'snow-outline', 'moon', 'sunny',
  'flame', 'bonfire', 'gift', 'balloon', 'color-palette', 'ellipse', 'musical-notes',
  'diamond', 'planet', 'trophy', 'ribbon', 'water', 'cloud', 'rocket', 'happy',
  'shield-checkmark', 'school', 'medal', 'flag', 'megaphone', 'calendar',
]);

export const SECTION_KEYS = ['olympiad', 'mittfest', 'learning', 'parenting', 'school', 'rows'];

export const DEFAULT_APP_THEME = Object.freeze({
  id: null,
  key: 'default',
  isDefault: true,
  colors: {
    bg: ['#FBF6EE', '#FFF8F0', '#F3EEE3'],
    header: ['#FFF8F0', '#FBF6EE', '#FFF8F0'],
    glowA: ['rgba(62,130,224,0.20)', 'rgba(62,130,224,0.06)', 'transparent'],
    glowB: ['rgba(245,166,35,0.22)', 'rgba(240,114,154,0.12)', 'transparent'],
    divider: ['transparent', '#F0729A', '#F5A623', '#1FAE8E', '#3E82E0', 'transparent'],
    brand: ['#1FAE8E', '#3E82E0'],
    primary: '#1FAE8E',
    refresh: ['#1FAE8E', '#3E82E0', '#F0729A', '#F5A623'],
    accent: '#F5A623',
    accentText: '#FFFFFF',
    statusBar: 'dark-content',
  },
  header: {
    subtitle: 'Talent & Olympiad Hub',
    tagline: "India's Most Trusted Olympiad Platform",
    taglineIcon: 'shield-checkmark',
    artUrl: '',
  },
  // icons/colors null = HomeScreen's own sparkle set, untouched.
  decor: { icons: null, colors: null, effect: 'static', density: 'medium', clouds: true, puzzles: true },
  background: { imageUrl: '', fit: 'cover', opacity: 0.3 },
  sections: SECTION_KEYS.map(key => ({ key, visible: true, title: '' })),
  hero: null,
});

const HEX = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const isHex = v => typeof v === 'string' && HEX.test(v);
const str = (v, fallback) => (typeof v === 'string' ? v : fallback);
// Absolute URL as-is; a bare path (/uploads/…, sent for images stored on the
// server itself) gets the address this build already talks to — so a dev
// server's "localhost" images still load on a phone/emulator.
const SERVER_ORIGIN = API_BASE.replace(/\/api\/?$/, '');
const httpUrl = v => {
  if (typeof v !== 'string') return '';
  if (/^https?:\/\//i.test(v)) return v;
  return v.startsWith('/') && !v.startsWith('//') ? `${SERVER_ORIGIN}${v}` : '';
};
const hexList = (v, min, fallback) => {
  const list = Array.isArray(v) ? v.filter(isHex) : [];
  return list.length >= min ? list : fallback;
};

// '#RRGGBB[AA]' + alpha → 'rgba(…)'.
export function hexA(hex, alpha) {
  if (!isHex(hex)) return `rgba(0,0,0,${alpha})`;
  const n = parseInt(hex.slice(1, 7), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

function resolveSections(list) {
  if (!Array.isArray(list)) return DEFAULT_APP_THEME.sections;
  const seen = new Set();
  const out = [];
  for (const s of list) {
    if (!s || !SECTION_KEYS.includes(s.key) || seen.has(s.key)) continue;
    seen.add(s.key);
    out.push({ key: s.key, visible: s.visible !== false, title: str(s.title, '').trim() });
  }
  // A section this build knows but the theme doesn't mention stays visible.
  for (const key of SECTION_KEYS) if (!seen.has(key)) out.push({ key, visible: true, title: '' });
  return out;
}

export function resolveAppTheme(payload) {
  const cfg = payload?.config;
  if (!payload?.id || !cfg || typeof cfg !== 'object') return DEFAULT_APP_THEME;
  const D = DEFAULT_APP_THEME;
  const c = cfg.colors || {};
  const h = cfg.header || {};
  const d = cfg.decor || {};
  const b = cfg.background || {};

  const glow = hexList(c.glow, 2, null);
  const divider = hexList(c.divider, 2, null);
  const primary = isHex(c.primary) ? c.primary : D.colors.primary;
  const accent = isHex(c.accent) ? c.accent : D.colors.accent;
  const brand = hexList(c.brand, 2, D.colors.brand);

  const icons = Array.isArray(d.icons) ? d.icons.filter(i => typeof i === 'string' && i.trim()).slice(0, 8) : [];
  const decorColors = hexList(d.colors, 1, null);

  return {
    id: payload.id,
    // Changes whenever the SuperAdmin edits the theme.
    key: `${payload.id}:${payload.updatedAt || ''}`,
    isDefault: false,
    name: str(payload.name, ''),
    endsAt: payload.endsAt || null,
    colors: {
      bg: hexList(c.bg, 2, D.colors.bg),
      header: hexList(c.header, 2, D.colors.header),
      glowA: glow ? [hexA(glow[0], 0.2), hexA(glow[0], 0.06), 'transparent'] : D.colors.glowA,
      glowB: glow ? [hexA(glow[1], 0.22), hexA(glow[1], 0.1), 'transparent'] : D.colors.glowB,
      divider: divider ? ['transparent', ...divider, 'transparent'] : D.colors.divider,
      brand,
      primary,
      refresh: [primary, brand[1], accent],
      accent,
      accentText: isHex(c.accentText) ? c.accentText : D.colors.accentText,
      statusBar: c.statusBar === 'light' ? 'light-content' : 'dark-content',
    },
    header: {
      subtitle: str(h.subtitle, D.header.subtitle),
      tagline: str(h.tagline, D.header.tagline),
      taglineIcon: THEME_ICONS.has(h.taglineIcon) ? h.taglineIcon : D.header.taglineIcon,
      artUrl: httpUrl(h.artUrl),
    },
    decor: {
      icons: icons.length ? icons : null,
      colors: decorColors,
      effect: ['none', 'static', 'fall'].includes(d.effect) ? d.effect : 'static',
      density: ['low', 'medium', 'high'].includes(d.density) ? d.density : 'medium',
      clouds: d.clouds !== false,
      puzzles: d.puzzles !== false,
    },
    background: {
      imageUrl: httpUrl(b.imageUrl),
      fit: b.fit === 'tile' ? 'tile' : 'cover',
      opacity: typeof b.opacity === 'number' ? Math.min(1, Math.max(0.02, b.opacity)) : 0.3,
    },
    sections: resolveSections(cfg.sections),
    hero: resolveHero(cfg.hero),
    splash: resolveSplash(cfg.splash),
  };
}

// Opening splash screen. null = the built-in Mittmee splash.
function resolveSplash(sp) {
  if (!sp || sp.enabled !== true) return null;
  const pick = (v, allowed, dflt) => (allowed.includes(v) ? v : dflt);
  const bg = hexList(sp.bg, 1, ['#FBF6EE', '#FFF8F0', '#F3EEE3']);
  return {
    bg: bg.length === 1 ? [bg[0], bg[0]] : bg,
    // Built-in festival artwork (theme/splashArt.js); null = none / unknown to this build.
    art: typeof sp.art === 'string' && SPLASH_ART[sp.art] ? sp.art : null,
    imageUrl: httpUrl(sp.imageUrl),
    imageFit: pick(sp.imageFit, ['cover', 'contain'], 'cover'),
    logo: pick(sp.logo, ['center', 'top', 'hidden'], 'center'),
    logoSize: pick(sp.logoSize, ['small', 'medium', 'large'], 'medium'),
    kicker: str(sp.kicker, ''),
    title: str(sp.title, ''),
    subtitle: str(sp.subtitle, ''),
    textColor: isHex(sp.textColor) ? sp.textColor : '#241E18',
    animation: pick(sp.animation, ['pop', 'fade', 'slide', 'zoom'], 'pop'),
    decor: (Array.isArray(sp.decor) ? sp.decor : []).filter(i => typeof i === 'string' && i.trim()).slice(0, 6),
    decorColors: hexList(sp.decorColors, 1, ['#FFFFFF']),
    durationMs: typeof sp.durationMs === 'number' ? Math.min(5000, Math.max(1200, sp.durationMs)) : 2600,
    skippable: sp.skippable === true,
  };
}

// Blend two '#RRGGBB' colours: t = 0 → a, t = 1 → b. Used to derive the
// festive page tint and softer shades from a theme's own colours.
export function mixHex(a, b, t) {
  if (!isHex(a) || !isHex(b)) return isHex(a) ? a.slice(0, 7) : '#FFFFFF';
  const pa = parseInt(a.slice(1, 7), 16), pb = parseInt(b.slice(1, 7), 16);
  const ch = (p, sh) => (p >> sh) & 255;
  const m = sh => Math.round(ch(pa, sh) + (ch(pb, sh) - ch(pa, sh)) * t);
  return `#${[16, 8, 0].map(sh => m(sh).toString(16).padStart(2, '0')).join('')}`;
}

// Relative luminance → whether dark text reads on this colour.
export function isLightColor(hex) {
  if (!isHex(hex)) return true;
  const n = parseInt(hex.slice(1, 7), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62;
}

// "Festive top" (Amazon / Blinkit / Swiggy style): colour band behind the
// header + carousel, masthead and festive tiles. null = not used.
function resolveHero(h) {
  if (!h || h.enabled !== true) return null;
  const colors = hexList(h.colors, 2, null);
  if (!colors) return null;
  const tiles = (Array.isArray(h.tiles) ? h.tiles : [])
    .filter(t => t && typeof t.label === 'string' && t.label.trim())
    .slice(0, 8)
    .map(t => ({
      label: t.label.trim(),
      emoji: str(t.emoji, ''),
      imageUrl: httpUrl(t.imageUrl),
      linkUrl: str(t.linkUrl, ''),
      color: isHex(t.color) ? t.color : '#FFFFFF',
    }));
  return {
    colors,
    followSlides: h.followSlides !== false,
    light: h.textTone === 'light',
    mastheadUrl: httpUrl(h.mastheadUrl),
    kicker: str(h.kicker, ''),
    title: str(h.title, ''),
    emoji: str(h.emoji, ''),
    textColor: isHex(h.textColor) ? h.textColor : '#FFFFFF',
    bunting: h.bunting !== false,
    // Festival decoration behind the header (theme/splashArt.js); null = none.
    headerArt: typeof h.headerArt === 'string' && SPLASH_ART[h.headerArt]?.header ? h.headerArt : null,
    tilesTitle: str(h.tilesTitle, ''),
    // Off unless the SuperAdmin switched them on.
    showTiles: h.showTiles === true,
    tiles,
  };
}

// Remote images a theme draws — fetched before the theme is shown, so it
// never appears half-loaded.
export function themeImageUrls(payload) {
  const cfg = payload?.config || {};
  const hero = cfg.hero?.enabled ? [cfg.hero.mastheadUrl, ...(cfg.hero.tiles || []).map(t => t?.imageUrl)] : [];
  // The splash poster too, so it's already on the phone for the next launch.
  const splash = cfg.splash?.enabled ? [cfg.splash.imageUrl] : [];
  return [cfg.header?.artUrl, cfg.background?.imageUrl, ...hero, ...splash].map(httpUrl).filter(Boolean);
}
