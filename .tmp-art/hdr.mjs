import sharp from 'sharp';
import { SPLASH_ART } from './splashArt.mjs';
const mix = (a, b, t) => { const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16); return '#' + [16, 8, 0].map(s => Math.round(((pa >> s) & 255) + ((((pb >> s) & 255) - ((pa >> s) & 255)) * t)).toString(16).padStart(2, '0')).join(''); };
const BAND = { diwali: ['#FF8A1F', 0], navratri: ['#FFB627', 0], 'childrens-day': ['#4DABF7', 1], christmas: ['#1E7B3A', 1], 'new-year': ['#3B1F8F', 1], national: ['#FF9F43', 0], holi: ['#F06595', 1], eid: ['#0B4F3C', 1], ganesh: ['#FF922B', 0], rakhi: ['#F783AC', 0], everyday: ['#3E82E0', 1] };
const rows = [];
for (const [id, t] of Object.entries(SPLASH_ART)) {
  const [c, light] = BAND[id];
  const ink = light ? '#FFFFFF' : mix(c, '#1A0A00', 0.72);
  const art = t.header.replace('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 110" preserveAspectRatio="xMidYMax slice">', '<svg x="0" y="0" width="360" height="110" viewBox="0 0 360 110" preserveAspectRatio="xMidYMax slice">');
  let bunt = ''; const fl = ['#E63946', '#FF9F1C', '#FFD166', '#2A9D8F'];
  for (let i = 0; i < 16; i++) bunt += `<polygon points="${i * 22.5 + 3},110 ${i * 22.5 + 19.5},110 ${i * 22.5 + 11.25},121" fill="${fl[i % 4]}"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="124"><rect width="360" height="124" fill="${c}"/>${art}
    <circle cx="34" cy="62" r="17" fill="#fff"/><text x="58" y="62" font-family="Arial" font-weight="900" font-size="19" fill="${ink}">mittmee</text>
    <text x="58" y="78" font-family="Arial" font-weight="700" font-size="8.5" fill="${ink}" fill-opacity=".8">Talent &amp; Olympiad Hub</text>
    <circle cx="290" cy="60" r="16" fill="#fff"/><circle cx="328" cy="60" r="16" fill="#fff"/>${bunt}
    <text x="352" y="20" text-anchor="end" font-family="Arial" font-size="10" fill="#fff" fill-opacity=".8">${id}</text></svg>`;
  rows.push(await sharp(Buffer.from(svg)).png().toBuffer());
}
const cols = 3;
await sharp({ create: { width: cols * 366, height: Math.ceil(rows.length / cols) * 130, channels: 4, background: '#222' } })
  .composite(rows.map((b, i) => ({ input: b, left: (i % cols) * 366 + 3, top: Math.floor(i / cols) * 130 + 3 }))).png().toFile(process.argv[2]);
console.log('ok');
