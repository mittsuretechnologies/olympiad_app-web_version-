import sharp from 'sharp';
const mix = (a, b, t) => { const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16); return '#' + [16, 8, 0].map(s => Math.round(((pa >> s) & 255) + ((((pb >> s) & 255) - ((pa >> s) & 255)) * t)).toString(16).padStart(2, '0')).join(''); };
const arch = (c) => `<path d="M14,150 V82 C14,58 40,48 78,44 C120,40 150,30 166,14 Q174,6 180,0 Q186,6 194,14 C210,30 240,40 282,44 C320,48 346,58 346,82 V150" fill="${c}" fill-opacity="0.12" stroke="${c}" stroke-opacity="0.55" stroke-width="2"/><path d="M28,150 V86 C28,66 50,58 84,55 C124,51 152,41 168,26 Q176,19 180,14 Q184,19 192,26 C208,41 236,51 276,55 C310,58 332,66 332,86 V150" fill="none" stroke="${c}" stroke-opacity="0.3" stroke-width="1.4" stroke-dasharray="2 4"/><circle cx="180" cy="22" r="3" fill="${c}" fill-opacity="0.8"/><line x1="78" y1="44" x2="78" y2="68" stroke="${c}" stroke-opacity="0.5"/><path d="M72,76 Q78,62 84,76 Z" fill="${c}" fill-opacity="0.6"/><line x1="282" y1="44" x2="282" y2="68" stroke="${c}" stroke-opacity="0.5"/><path d="M276,76 Q282,62 288,76 Z" fill="${c}" fill-opacity="0.6"/>`;
const lace = (c) => { let a = '', d = ''; for (let i = 0; i < 30; i++) { a += ` A6,6 0 0 1 ${12 * (i + 1)},10`; d += `<circle cx="${12 * i + 6}" cy="2.5" r="1.5" fill="${c}" fill-opacity="0.9"/>`; } return `<path d="M0,18 V10${a} V18 Z" fill="${c}"/>${d}`; };
const themes = [['Diwali', '#FF8A1F', '#FFC078', '#7A2E00'], ['Navratri', '#FFB627', '#FFE08A', '#B3122E'], ['Christmas', '#1E7B3A', '#5FB878', '#FFFFFF'], ['Holi', '#F06595', '#FCC2D7', '#FFFFFF']];
const tiles = [];
for (const [name, c0, c1, tc] of themes) {
  const top = mix(c1, '#FFFFFF', 0.7), mid = mix(c1, '#FFFDF8', 0.88), low = mix(c1, '#FFFFFF', 0.4);
  const headerH = 96, bandBottom = 372;
  const flags = ['#E63946', '#FF9F1C', '#FFD166', '#2A9D8F']; let bunt = '';
  for (let i = 0; i < 16; i++) bunt += `<polygon points="${i * 22.5 + 3},${headerH} ${i * 22.5 + 19.5},${headerH} ${i * 22.5 + 11.25},${headerH + 11}" fill="${flags[i % 4]}"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="780">
  <defs><linearGradient id="pg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset=".5" stop-color="${mid}"/><stop offset="1" stop-color="#F3EEE3"/></linearGradient>
  <linearGradient id="bd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c1}" stop-opacity="0"/><stop offset=".62" stop-color="${c1}" stop-opacity=".85"/><stop offset="1" stop-color="${low}"/></linearGradient></defs>
  <rect width="360" height="780" fill="url(#pg)"/>
  <rect width="360" height="${bandBottom}" fill="${c0}"/>
  <rect y="${headerH}" width="360" height="${bandBottom - headerH}" fill="url(#bd)"/>
  <svg x="0" y="${headerH - 4}" width="360" height="150" viewBox="0 0 360 150">${arch('#FFFFFF')}</svg>
  <svg x="0" y="${bandBottom - 17}" width="360" height="18" viewBox="0 0 360 18">${lace(top)}</svg>
  <circle cx="34" cy="56" r="16" fill="#fff"/><text x="58" y="56" font-family="Arial" font-weight="900" font-size="18" fill="${tc === '#FFFFFF' ? '#fff' : '#1FAE8E'}">mittmee</text>
  <circle cx="290" cy="52" r="15" fill="#fff"/><circle cx="326" cy="52" r="15" fill="#fff"/>
  ${bunt}
  <text x="180" y="132" text-anchor="middle" font-family="Arial" font-weight="800" font-size="9" letter-spacing="3" fill="${tc}">✦ CELEBRATE ✦</text>
  <text x="180" y="166" text-anchor="middle" font-family="Georgia" font-style="italic" font-weight="bold" font-size="30" fill="${tc}">${name}</text>
  <rect x="14" y="184" width="332" height="160" rx="18" fill="#2b2b33"/><rect x="14" y="290" width="332" height="54" rx="0" fill="#000" fill-opacity=".35"/>
  <rect x="160" y="354" width="18" height="5" rx="2.5" fill="${c0}"/>
  <circle cx="40" cy="408" r="16" fill="#FFF4D6"/><text x="66" y="413" font-family="Arial" font-weight="800" font-size="15" fill="#241E18">Olympiad</text>
  <rect x="16" y="432" width="120" height="170" rx="14" fill="#E4F4F0" stroke="#9ED9C9" stroke-width="2"/><rect x="146" y="432" width="120" height="170" rx="14" fill="#E9F1FC" stroke="#A9C6F0" stroke-width="2"/><rect x="276" y="432" width="120" height="170" rx="14" fill="#FDEAF1" stroke="#F4B6CB" stroke-width="2"/>
  <circle cx="40" cy="650" r="16" fill="#EFE7FA"/><text x="66" y="655" font-family="Arial" font-weight="800" font-size="15" fill="#241E18">MittFest</text>
  </svg>`;
  tiles.push(await sharp(Buffer.from(svg)).resize(270, 585).png().toBuffer());
}
await sharp({ create: { width: 4 * 276, height: 591, channels: 4, background: '#222' } }).composite(tiles.map((b, i) => ({ input: b, left: i * 276 + 3, top: 3 }))).png().toFile(process.argv[2]);
console.log('ok');
