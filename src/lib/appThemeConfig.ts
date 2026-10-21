import { z } from 'zod';
import { SPLASH_ART_IDS } from '@/lib/splashArt';

// Shape of AppTheme.config — the SuperAdmin-controlled look of the mobile app
// home screen. Client-safe (no prisma): the dashboard editor imports the same
// schema, defaults and presets the API validates with.
//
// Every field has a default equal to the app's built-in look, so a theme only
// has to set what it changes and `appThemeConfigSchema.parse({})` is exactly
// "no theme". The app also falls back field-by-field, so adding a key here
// never breaks an older build — it just ignores it.

// Ionicons glyphs the app is known to ship. Decorations may also be a short
// emoji (🪔 🎄 🇮🇳 …) — anything else is refused so the app never draws a "?".
export const THEME_ICONS = [
  'star', 'star-outline', 'sparkles', 'sparkles-outline', 'heart', 'heart-outline',
  'flower', 'flower-outline', 'rose', 'leaf', 'snow', 'snow-outline', 'moon', 'sunny',
  'flame', 'bonfire', 'gift', 'balloon', 'color-palette', 'ellipse', 'musical-notes',
  'diamond', 'planet', 'trophy', 'ribbon', 'water', 'cloud', 'rocket', 'happy',
  'shield-checkmark', 'school', 'medal', 'flag', 'megaphone', 'calendar',
] as const;

export const SECTION_KEYS = ['olympiad', 'mittfest', 'learning', 'parenting', 'school', 'rows'] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];

export const SECTION_LABELS: Record<SectionKey, string> = {
  olympiad: 'Olympiad videos',
  mittfest: 'MittFest',
  learning: 'Learning',
  parenting: 'Parenting',
  school: 'Videos From Your School',
  rows: 'Trending & category rows',
};

// In-app destinations a link may open (app://<Screen>[?q=search]). Plain
// http(s) links open in the browser.
export const APP_LINK_SCREENS = ['Upload', 'Search', 'Reels', 'Profile', 'MySchool'] as const;

const HEX = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const hex = z.string().trim().regex(HEX, 'Colours must be hex, e.g. #FF9F1C');
const palette = (min: number, max: number) => z.array(hex).min(min).max(max);
// A colour that may be left empty ('' = use the app's own).
const optionalHex = z.string().trim().refine((v) => v === '' || HEX.test(v), 'Colours must be hex, e.g. #FF9F1C').default('');

const imageUrl = z.string().trim().max(1000)
  .refine((v) => v === '' || /^https?:\/\//i.test(v), 'Image must be an http(s) URL');

const linkUrl = z.string().trim().max(1000).refine(
  (v) => v === '' || /^https?:\/\//i.test(v) || new RegExp(`^app://(${APP_LINK_SCREENS.join('|')})(\\?.*)?$`).test(v),
  `Link must be https://… or app://${APP_LINK_SCREENS.join('|')}`,
);

const isIcon = (v: string) => (THEME_ICONS as readonly string[]).includes(v);
// An emoji: short, and no ASCII letters/digits (so a misspelt icon name is caught).
const isEmoji = (v: string) => v.length <= 16 && !/[A-Za-z0-9<>&"']/.test(v);
const decorItem = z.string().trim().min(1).refine((v) => isIcon(v) || isEmoji(v), 'Unknown icon — pick from the list or use an emoji');
const icon = z.string().trim().refine(isIcon, 'Unknown icon');

export const DEFAULT_SECTIONS = SECTION_KEYS.map((key) => ({ key, visible: true, title: '' }));

const sectionsSchema = z
  .array(z.object({
    key: z.string(),
    visible: z.boolean().default(true),
    title: z.string().trim().max(40).default(''),
  }))
  .default(DEFAULT_SECTIONS)
  // Unknown keys dropped, duplicates collapsed, and any section this list
  // doesn't mention appended visible — so a section added in a later release
  // still shows under a theme saved before it existed.
  .transform((list) => {
    const seen = new Set<string>();
    const out: { key: SectionKey; visible: boolean; title: string }[] = [];
    for (const s of list) {
      if (!(SECTION_KEYS as readonly string[]).includes(s.key) || seen.has(s.key)) continue;
      seen.add(s.key);
      out.push({ key: s.key as SectionKey, visible: s.visible, title: s.title });
    }
    for (const key of SECTION_KEYS) if (!seen.has(key)) out.push({ key, visible: true, title: '' });
    return out;
  });

export const appThemeConfigSchema = z.object({
  colors: z.object({
    bg: palette(2, 3).default(['#FBF6EE', '#FFF8F0', '#F3EEE3']),        // page gradient
    bgDirection: z.enum(['vertical', 'diagonal', 'horizontal']).default('diagonal'),
    // Text on the page itself (video titles + names under the cards, section
    // headings when those aren't set). '' = the app's own dark text.
    text: optionalHex,
    header: palette(2, 3).default(['#FFF8F0', '#FBF6EE', '#FFF8F0']),    // sticky header gradient
    glow: palette(2, 2).default(['#3E82E0', '#F5A623']),                 // the two soft header glows
    divider: palette(2, 6).default(['#F0729A', '#F5A623', '#1FAE8E', '#3E82E0']),
    brand: palette(2, 2).default(['#1FAE8E', '#3E82E0']),                // "mitt" / "mee"
    primary: hex.default('#1FAE8E'),                                     // pull-to-refresh, logo ring
    accent: hex.default('#F5A623'),                                      // tagline pill, carousel dot
    accentText: hex.default('#FFFFFF'),
    statusBar: z.enum(['dark', 'light']).default('dark'),
    // Home screen sections. '' = the app's own colours (each row keeps its
    // own icon colour); set = one colour for every section heading / chip.
    sectionTitle: optionalHex,                                           // "Olympiad", "MittFest" … headings
    sectionAccent: optionalHex,                                          // section icon + "See all" chip
    // Bottom tab bar (shown on every tab). Defaults = the original look.
    tabBar: palette(2, 2).default(['#1FAE8E', '#3E82E0']),               // bar gradient, left → right
    tabBarIcon: hex.default('#128064'),                                  // icon in the white active pill
  }).default({}),
  header: z.object({
    subtitle: z.string().trim().max(40).default('Talent & Olympiad Hub'),
    tagline: z.string().trim().max(60).default("India's Most Trusted Olympiad Platform"),
    taglineIcon: icon.default('shield-checkmark'),
  }).default({}),
  // No longer shown by the app (the festival carousel slide was removed);
  // kept so themes saved with it still validate.
  greeting: z.object({
    enabled: z.boolean().default(false),
    title: z.string().trim().max(60).default(''),
    subtitle: z.string().trim().max(140).default(''),
    emoji: z.string().trim().max(16).default(''),
    imageUrl: imageUrl.default(''),                                      // replaces the emoji when set
    // cover = photo fills the art side and fades into the text (like video
    // cards); contain = a transparent PNG sticker sitting on the gradient.
    imageFit: z.enum(['cover', 'contain']).default('cover'),
    colors: palette(2, 3).default(['#FFE8CC', '#FFD8E4']),
    textColor: hex.default('#241E18'),
    ctaLabel: z.string().trim().max(24).default(''),
    linkUrl: linkUrl.default(''),
    dismissible: z.boolean().default(true),
  }).default({}),
  decor: z.object({
    // Empty = the app's own stars/sparkles in its own colours.
    icons: z.array(decorItem).max(8).default([]),
    colors: z.array(hex).max(8).default([]),
    effect: z.enum(['none', 'static', 'fall']).default('static'),
    density: z.enum(['low', 'medium', 'high']).default('medium'),
    clouds: z.boolean().default(true),
    puzzles: z.boolean().default(true),
  }).default({}),
  background: z.object({
    imageUrl: imageUrl.default(''),                                      // behind the whole page
    // cover = one picture stretched over the page; tile = a small pattern repeated.
    fit: z.enum(['cover', 'tile']).default('cover'),
    opacity: z.number().min(0.02).max(1).default(0.3),
  }).default({}),
  // "Festive top" — the Amazon / Blinkit / Swiggy pattern: the app keeps its
  // normal look, and only the top of Home dresses up — a colour band behind
  // the header and carousel that fades into the page (following the colour
  // of the slide on screen), a masthead (artwork, or "CELEBRATE / Navratri"
  // drawn by the app) and a row of festive shortcut tiles.
  hero: z.object({
    enabled: z.boolean().default(true),                                  // on by default; tiles below are not
    colors: palette(2, 2).default(['#FF8A1F', '#FFC078']),               // band: top, bottom (before the fade)
    followSlides: z.boolean().default(true),                             // band takes each slide's colour while swiping
    textTone: z.enum(['dark', 'light']).default('dark'),                 // header text on the band
    kicker: z.string().trim().max(24).default(''),                       // small spaced caps, e.g. CELEBRATE
    title: z.string().trim().max(28).default(''),                        // big festive word, e.g. Navratri
    emoji: z.string().trim().max(16).default(''),                        // either side of the title
    textColor: hex.default('#FFFFFF'),
    // Masthead layout. Defaults = the original: centred, emoji both sides,
    // small line above a classic italic title.
    emojiPlacement: z.enum(['both', 'left', 'right', 'above', 'none']).default('both'),
    align: z.enum(['center', 'left', 'right']).default('center'),
    titleSize: z.enum(['small', 'medium', 'large']).default('medium'),
    titleStyle: z.enum(['classic', 'modern']).default('classic'),        // classic = italic serif, modern = bold sans
    kickerPosition: z.enum(['above', 'below']).default('above'),
    bunting: z.boolean().default(true),                                  // little festive flags under the header
    // Festival decoration behind the header (src/lib/splashArt.js — same ids
    // as the splash artwork). 'none' = plain band colour.
    headerArt: z.string().default('none')
      .refine((v) => v === 'none' || SPLASH_ART_IDS.includes(v), 'Unknown header decoration'),
    // Festive shortcut tiles are off unless switched on — presets fill them in.
    showTiles: z.boolean().default(false),
    tilesTitle: z.string().trim().max(30).default(''),                   // e.g. Festive Picks
    tiles: z.array(z.object({
      label: z.string().trim().min(1, 'Tile needs a label').max(24),
      emoji: z.string().trim().max(16).default(''),
      linkUrl: linkUrl.default(''),
      color: hex.default('#FFFFFF'),
    })).max(8).default([]),
  }).default({}),
  // Splash screen shown when the app opens (the animated one after the
  // phone's own launch screen). The app shows the splash it saved on the
  // PREVIOUS run — it never waits for the network at startup — so a change
  // reaches a phone on its next launch. Off = the built-in Mittmee splash.
  splash: z.object({
    enabled: z.boolean().default(false),
    bg: palette(1, 3).default(['#FBF6EE', '#FFF8F0', '#F3EEE3']),        // gradient (or one solid colour)
    // Built-in festival artwork (src/lib/splashArt.js): a top decoration and a
    // bottom scene drawn by the app — no upload needed. 'none' = no artwork.
    art: z.string().default('none')
      .refine((v) => v === 'none' || SPLASH_ART_IDS.includes(v), 'Unknown artwork'),
    imageUrl: imageUrl.default(''),                                      // full-screen poster (optional)
    imageFit: z.enum(['cover', 'contain']).default('cover'),
    logo: z.enum(['center', 'top', 'hidden']).default('center'),
    logoSize: z.enum(['small', 'medium', 'large']).default('medium'),
    kicker: z.string().trim().max(24).default(''),                       // small spaced caps, e.g. HAPPY
    title: z.string().trim().max(28).default(''),                        // big festive word, e.g. Diwali
    subtitle: z.string().trim().max(80).default(''),
    textColor: hex.default('#241E18'),
    animation: z.enum(['pop', 'fade', 'slide', 'zoom']).default('pop'),
    decor: z.array(decorItem).max(6).default([]),                       // falling icons/emoji; empty = none
    decorColors: z.array(hex).max(6).default([]),
    durationMs: z.number().int().min(1200).max(5000).default(1800),        // editor offers up to 3.5 s
    skippable: z.boolean().default(false),
  }).default({}),
  sections: sectionsSchema,
});

export type AppThemeConfig = z.infer<typeof appThemeConfigSchema>;
export type AppThemeConfigInput = z.input<typeof appThemeConfigSchema>;

export const DEFAULT_THEME_CONFIG: AppThemeConfig = appThemeConfigSchema.parse({});

// Reading a stored config: never throw — a row saved under an older/looser
// schema falls back to defaults rather than taking the endpoint down.
export function normalizeThemeConfig(raw: unknown): AppThemeConfig {
  const r = appThemeConfigSchema.safeParse(raw ?? {});
  return r.success ? r.data : DEFAULT_THEME_CONFIG;
}


// Presets live in their own file; re-exported so existing imports keep working.
export { THEME_PRESETS, type ThemePreset } from '@/lib/appThemePresets';
