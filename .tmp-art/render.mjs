import sharp from 'sharp';
import { SPLASH_ART } from './splashArt.mjs';
const BG = {
  diwali: ['#FF8A1F', '#E8590C', '#9C2A00'], navratri: ['#FFB627', '#F76707', '#C2255C'], 'childrens-day': ['#4DABF7', '#748FFC', '#F783AC'],
  christmas: ['#1E7B3A', '#145A2B', '#0B3B1C'], 'new-year': ['#3B1F8F', '#1F1147', '#0D0726'], national: ['#FF9F43', '#FFFFFF', '#2F9E44'],
  holi: ['#F06595', '#845EF7', '#339AF0'], eid: ['#0B4F3C', '#0A3A2D', '#062219'], ganesh: ['#FF922B', '#F76707', '#C92A2A'],
  rakhi: ['#F783AC', '#E64980', '#A61E4D'], everyday: ['#E6FCF5', '#E7F5FF', '#FFFFFF'],
};
const nest = (s, y, h, id) => s.replace(/<svg xmlns="http:\/\/www.w3.org\/2000\/svg" viewBox="([^"]+)">/, `<svg x="0" y="${y}" width="360" height="${h}" viewBox="$1">`).replaceAll('url(#glow)', `url(#${id})`).replaceAll('id="glow"', `id="${id}"`);
const tiles = [];
for (const [id, t] of Object.entries(SPLASH_ART)) {
  const bg = BG[id];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="780" viewBox="0 0 360 780">
    <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">${bg.map((c, i) => `<stop offset="${i / (bg.length - 1)}" stop-color="${c}"/>`).join('')}</linearGradient></defs>
    <rect width="360" height="780" fill="url(#bg)"/>
    ${nest(t.top, 0, 200, 'gt')}
    ${nest(t.bottom, 540, 240, 'gb')}
    <circle cx="180" cy="330" r="58" fill="#fff"/><text x="180" y="338" font-size="22" text-anchor="middle" font-family="Arial" font-weight="bold" fill="#1FAE8E">LOGO</text>
    <text x="180" y="440" font-size="40" text-anchor="middle" font-family="Georgia" font-style="italic" font-weight="bold" fill="#fff" stroke="#0004" stroke-width="0.5">${id}</text>
  </svg>`;
  tiles.push(await sharp(Buffer.from(svg)).resize(180, 390).png().toBuffer());
}
const cols = 6, rows = Math.ceil(tiles.length / cols);
await sharp({ create: { width: cols * 186, height: rows * 396, channels: 4, background: '#222' } })
  .composite(tiles.map((b, i) => ({ input: b, left: (i % cols) * 186 + 3, top: Math.floor(i / cols) * 396 + 3 })))
  .png().toFile(process.argv[2]);
console.log('ok', tiles.length);
