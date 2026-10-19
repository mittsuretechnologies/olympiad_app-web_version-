import type { AppThemeConfigInput } from '@/lib/appThemeConfig';

// One-click festival presets for Dashboard → App Theme & Festivals. The
// SuperAdmin picks one, sets the dates and tweaks. Only what differs from the
// defaults is listed. The festive top is on (band + masthead); its tiles come
// pre-filled but switched OFF until turned on in the Festive top tab.
//
// Like Amazon / Blinkit / Swiggy, a festival dresses up the TOP of Home only
// (colour band, masthead, festive tiles);
// the page itself keeps the normal Mittmee look. `colors.accent` only
// recolours the tagline pill and the carousel dots.

export interface ThemePreset { id: string; name: string; emoji: string; config: AppThemeConfigInput }

const UPLOAD = 'app://Upload';
const search = (q: string) => `app://Search?q=${encodeURIComponent(q)}`;

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'classic', name: 'Mittmee Classic', emoji: '⭐',
    // The plain Mittmee look — no festive top.
    config: { hero: { enabled: false } },
  },
  {
    id: 'diwali', name: 'Diwali', emoji: '🪔',
    config: {
      colors: { accent: '#E8590C', divider: ['#E63946', '#FF9F1C', '#FFD166', '#FF9F1C', '#E63946'] },
      header: { tagline: 'Happy Diwali from Mittmee 🪔', taglineIcon: 'sparkles' },
      hero: {
        enabled: true, colors: ['#FF8A1F', '#FFC078'], kicker: 'CELEBRATE', title: 'Diwali', emoji: '🪔',
        tilesTitle: 'Festive Picks',
        tiles: [
          { label: 'Diwali Songs', emoji: '🎶', linkUrl: search('diwali'), color: '#FFF4E6' },
          { label: 'Rangoli Art', emoji: '🎨', linkUrl: search('rangoli'), color: '#FFF0F6' },
          { label: 'Dance', emoji: '💃', linkUrl: search('dance'), color: '#FFF9DB' },
          { label: 'Upload Yours', emoji: '📹', linkUrl: UPLOAD, color: '#EBFBEE' },
        ],
      },
    },
  },
  {
    id: 'navratri', name: 'Navratri & Dussehra', emoji: '🏹',
    config: {
      colors: { accent: '#D6336C', divider: ['#D6336C', '#F76707', '#FAB005', '#F76707', '#D6336C'] },
      header: { tagline: 'Happy Navratri & Dussehra!', taglineIcon: 'flame' },
      hero: {
        enabled: true, colors: ['#FFB627', '#FFE08A'], kicker: 'CELEBRATE', title: 'Navratri', emoji: '🪔',
        textColor: '#B3122E', tilesTitle: 'Festive Picks',
        tiles: [
          { label: 'Garba Nights', emoji: '💃', linkUrl: search('garba'), color: '#FFF0F6' },
          { label: 'Dandiya', emoji: '🥢', linkUrl: search('dandiya'), color: '#FFF4E6' },
          { label: 'Bhajans', emoji: '🪔', linkUrl: search('bhajan'), color: '#FFF9DB' },
          { label: 'Upload Yours', emoji: '📹', linkUrl: UPLOAD, color: '#EBFBEE' },
        ],
      },
    },
  },
  {
    id: 'childrens-day', name: "Children's Day", emoji: '🎈',
    config: {
      colors: { accent: '#F06595', divider: ['#339AF0', '#FCC419', '#F06595', '#51CF66'] },
      header: { tagline: "Happy Children's Day! 🎈", taglineIcon: 'happy' },
      hero: {
        colors: ['#4DABF7', '#A5D8FF'], textTone: 'light', kicker: 'HAPPY', title: "Children's Day", emoji: '🎈',
        tilesTitle: 'Fun For You',
        tiles: [
          { label: 'Drawing', emoji: '🖍️', linkUrl: search('drawing'), color: '#FFF9DB' },
          { label: 'Singing', emoji: '🎤', linkUrl: search('singing'), color: '#FFF0F6' },
          { label: 'Magic & Tricks', emoji: '🪄', linkUrl: search('magic'), color: '#F3F0FF' },
          { label: 'Upload Yours', emoji: '📹', linkUrl: UPLOAD, color: '#EBFBEE' },
        ],
      },
    },
  },
  {
    id: 'christmas', name: 'Christmas', emoji: '🎄',
    config: {
      colors: { accent: '#C92A2A', divider: ['#C92A2A', '#2B8A3E', '#FAB005', '#2B8A3E', '#C92A2A'] },
      header: { tagline: 'Merry Christmas from Mittmee 🎄', taglineIcon: 'gift' },
      hero: {
        colors: ['#1E7B3A', '#5FB878'], textTone: 'light', kicker: 'MERRY', title: 'Christmas', emoji: '🎄',
        tilesTitle: 'Holiday Picks',
        tiles: [
          { label: 'Carols', emoji: '🎶', linkUrl: search('carol'), color: '#FFF5F5' },
          { label: 'Santa Fun', emoji: '🎅', linkUrl: search('santa'), color: '#FFFFFF' },
          { label: 'Crafts', emoji: '✂️', linkUrl: search('craft'), color: '#FFF9DB' },
          { label: 'Upload Yours', emoji: '📹', linkUrl: UPLOAD, color: '#EBFBEE' },
        ],
      },
      decor: { icons: ['snow', '❄️'], colors: ['#74C0FC'], effect: 'fall', density: 'low' },
    },
  },
  {
    id: 'new-year', name: 'New Year', emoji: '🎉',
    config: {
      colors: { accent: '#7048E8', divider: ['#7048E8', '#FAB005', '#F06595', '#FAB005', '#7048E8'] },
      header: { tagline: 'Happy New Year from Mittmee 🎉', taglineIcon: 'sparkles' },
      hero: {
        colors: ['#3B1F8F', '#7048E8'], textTone: 'light', kicker: 'HAPPY', title: 'New Year', emoji: '🎉',
        textColor: '#FFD43B', tilesTitle: 'Start The Year Right',
        tiles: [
          { label: 'Dance', emoji: '💃', linkUrl: search('dance'), color: '#F3F0FF' },
          { label: 'Music', emoji: '🎸', linkUrl: search('music'), color: '#FFF9DB' },
          { label: 'Speeches', emoji: '📝', linkUrl: search('speech'), color: '#FFF0F6' },
          { label: 'Upload Yours', emoji: '📹', linkUrl: UPLOAD, color: '#EBFBEE' },
        ],
      },
    },
  },
  {
    id: 'national', name: 'Republic / Independence Day', emoji: '🇮🇳',
    config: {
      colors: { accent: '#1C3D8C', divider: ['#FF922B', '#FF922B', '#1C3D8C', '#2F9E44', '#2F9E44'] },
      header: { tagline: 'Jai Hind! Celebrating India 🇮🇳', taglineIcon: 'flag' },
      hero: {
        enabled: true, colors: ['#FF9F43', '#FFE8CC'], kicker: 'CELEBRATING', title: 'India', emoji: '🇮🇳',
        textColor: '#1C3D8C', tilesTitle: 'Desh Bhakti',
        tiles: [
          { label: 'Patriotic Songs', emoji: '🎶', linkUrl: search('patriotic'), color: '#FFF4E6' },
          { label: 'Speeches', emoji: '🎤', linkUrl: search('speech'), color: '#FFFFFF' },
          { label: 'Folk Dance', emoji: '💃', linkUrl: search('folk'), color: '#EBFBEE' },
          { label: 'Upload Yours', emoji: '📹', linkUrl: UPLOAD, color: '#E7F5FF' },
        ],
      },
    },
  },
  {
    id: 'holi', name: 'Holi', emoji: '🎨',
    config: {
      colors: { accent: '#E64980', divider: ['#F06595', '#FCC419', '#51CF66', '#339AF0', '#845EF7'] },
      header: { tagline: 'Happy Holi — play with colours!', taglineIcon: 'color-palette' },
      hero: {
        colors: ['#F06595', '#FCC2D7'], textTone: 'light', kicker: 'HAPPY', title: 'Holi', emoji: '🎨',
        tilesTitle: 'Colourful Picks',
        tiles: [
          { label: 'Holi Songs', emoji: '🎶', linkUrl: search('holi'), color: '#FFF0F6' },
          { label: 'Dance', emoji: '💃', linkUrl: search('dance'), color: '#F3F0FF' },
          { label: 'Art', emoji: '🎨', linkUrl: search('art'), color: '#FFF9DB' },
          { label: 'Upload Yours', emoji: '📹', linkUrl: UPLOAD, color: '#EBFBEE' },
        ],
      },
    },
  },
  {
    id: 'eid', name: 'Eid', emoji: '🌙',
    config: {
      colors: { accent: '#2B8A3E', divider: ['#2B8A3E', '#F59F00', '#2B8A3E'] },
      header: { tagline: 'Eid Mubarak from Mittmee 🌙', taglineIcon: 'moon' },
      hero: {
        colors: ['#0B4F3C', '#2B8A3E'], textTone: 'light', kicker: 'EID', title: 'Mubarak', emoji: '🌙',
        textColor: '#FFD43B', tilesTitle: 'Festive Picks',
        tiles: [
          { label: 'Naats & Songs', emoji: '🎶', linkUrl: search('song'), color: '#EBFBEE' },
          { label: 'Calligraphy', emoji: '✒️', linkUrl: search('calligraphy'), color: '#FFF9DB' },
          { label: 'Upload Yours', emoji: '📹', linkUrl: UPLOAD, color: '#FFFFFF' },
        ],
      },
    },
  },
  {
    id: 'ganesh', name: 'Ganesh Chaturthi', emoji: '🌺',
    config: {
      colors: { accent: '#E8590C', divider: ['#E03131', '#F76707', '#FAB005', '#F76707', '#E03131'] },
      header: { tagline: 'Ganpati Bappa Morya! 🌺', taglineIcon: 'flower' },
      hero: {
        enabled: true, colors: ['#FF922B', '#FFD8A8'], kicker: 'GANPATI', title: 'Bappa Morya', emoji: '🌺',
        textColor: '#9C1C1C', tilesTitle: 'Festive Picks',
        tiles: [
          { label: 'Aarti', emoji: '🪔', linkUrl: search('aarti'), color: '#FFF4E6' },
          { label: 'Dhol Tasha', emoji: '🥁', linkUrl: search('dhol'), color: '#FFF9DB' },
          { label: 'Decoration', emoji: '🌺', linkUrl: search('decoration'), color: '#FFF0F6' },
          { label: 'Upload Yours', emoji: '📹', linkUrl: UPLOAD, color: '#EBFBEE' },
        ],
      },
    },
  },
  {
    id: 'rakhi', name: 'Raksha Bandhan', emoji: '🎁',
    config: {
      colors: { accent: '#D6336C', divider: ['#E64980', '#FAB005', '#7048E8'] },
      header: { tagline: 'Happy Raksha Bandhan!', taglineIcon: 'heart' },
      hero: {
        enabled: true, colors: ['#F783AC', '#FFDEEB'], kicker: 'HAPPY', title: 'Raksha Bandhan', emoji: '🎁',
        textColor: '#A61E4D', tilesTitle: 'Sibling Specials',
        tiles: [
          { label: 'Sibling Duets', emoji: '🎤', linkUrl: search('duet'), color: '#FFF0F6' },
          { label: 'Rakhi Making', emoji: '🧵', linkUrl: search('rakhi'), color: '#FFF9DB' },
          { label: 'Upload Yours', emoji: '📹', linkUrl: UPLOAD, color: '#EBFBEE' },
        ],
      },
    },
  },
];
