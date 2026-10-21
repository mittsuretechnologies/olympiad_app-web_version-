// Built-in festival artwork for the splash screen — vector (SVG) drawings, so
// they're sharp on every phone, cost a few KB, and need no download (they
// work on the very first launch, offline).
//
// Each template has a TOP decoration (lanterns, garlands, ornaments …, drawn
// in a 360×200 box pinned to the top of the screen) and a BOTTOM scene
// (diyas, skyline, snowy trees …, 360×240 pinned to the bottom), leaving the
// middle free for the logo and text. Backgrounds stay transparent so the
// splash's own gradient shows through.
//
// SHARED FILE — an identical copy lives in the web project at
// src/lib/splashArt.js (dashboard preview) and the mobile app at
// Components/theme/splashArt.js. Edit both together.
//
// Plain JS on purpose (no TypeScript, no imports) so both projects can use it.

const n = (v) => Math.round(v * 10) / 10;
const svg = (vb, body, defs) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}"><defs>${defs || ''}</defs>${body}</svg>`;

// ── Reusable drawing parts ──────────────────────────────────────────────────
const glowDef = (id, color) =>
  `<radialGradient id="${id}" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="${color}" stop-opacity="0.85"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient>`;

function star(cx, cy, R, r, fill, opacity) {
  let pts = '';
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? R : r;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts += `${n(cx + rad * Math.cos(a))},${n(cy + rad * Math.sin(a))} `;
  }
  return `<polygon points="${pts.trim()}" fill="${fill}" fill-opacity="${opacity ?? 1}"/>`;
}

// Point on a quadratic curve P0→P2 bending toward P1.
const quad = (p0, p1, p2, t) => [
  (1 - t) * (1 - t) * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0],
  (1 - t) * (1 - t) * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1],
];

function diya(x, y, s) {
  return `<circle cx="${n(x)}" cy="${n(y - 16 * s)}" r="${n(30 * s)}" fill="url(#glow)"/>`
    + `<path d="M${n(x - 22 * s)},${n(y)} Q${n(x)},${n(y + 22 * s)} ${n(x + 22 * s)},${n(y)} Z" fill="#A0461A"/>`
    + `<path d="M${n(x - 22 * s)},${n(y)} Q${n(x)},${n(y + 10 * s)} ${n(x + 22 * s)},${n(y)} Z" fill="#C8642A"/>`
    + `<ellipse cx="${n(x)}" cy="${n(y)}" rx="${n(22 * s)}" ry="${n(4 * s)}" fill="#E8863A"/>`
    + `<path d="M${n(x)},${n(y - 28 * s)} C${n(x + 8 * s)},${n(y - 15 * s)} ${n(x + 7 * s)},${n(y - 4 * s)} ${n(x)},${n(y - 3 * s)} C${n(x - 7 * s)},${n(y - 4 * s)} ${n(x - 8 * s)},${n(y - 15 * s)} ${n(x)},${n(y - 28 * s)} Z" fill="#FFD43B"/>`
    + `<path d="M${n(x)},${n(y - 19 * s)} C${n(x + 4 * s)},${n(y - 11 * s)} ${n(x + 3.5 * s)},${n(y - 5 * s)} ${n(x)},${n(y - 4.5 * s)} C${n(x - 3.5 * s)},${n(y - 5 * s)} ${n(x - 4 * s)},${n(y - 11 * s)} ${n(x)},${n(y - 19 * s)} Z" fill="#FF6B1A"/>`;
}

// Half (or full) rangoli/mandala: rings of petals around a centre.
function mandala(cx, cy, R, colors) {
  let out = '';
  const rings = [[16, 0.95, 0.16], [12, 0.68, 0.14], [8, 0.42, 0.13]];
  rings.forEach(([count, k, w], ri) => {
    const c = colors[ri % colors.length];
    for (let i = 0; i < count; i++) {
      const a = (360 / count) * i + (ri % 2 ? 180 / count : 0);
      out += `<ellipse cx="${n(cx)}" cy="${n(cy - R * k * 0.62)}" rx="${n(R * w)}" ry="${n(R * k * 0.38)}" fill="${c}" transform="rotate(${n(a)} ${n(cx)} ${n(cy)})"/>`;
    }
  });
  out += `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(R * 0.2)}" fill="${colors[3 % colors.length]}"/>`;
  out += `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(R * 0.1)}" fill="#FFFFFF" fill-opacity="0.9"/>`;
  return out;
}

// Diwali kandil / generic hanging lantern.
function kandil(x, len, c1, c2) {
  const y = len;
  return `<line x1="${x}" y1="0" x2="${x}" y2="${y}" stroke="#7A3B12" stroke-width="1.5"/>`
    + `<circle cx="${x}" cy="${y + 24}" r="34" fill="url(#glow)"/>`
    + `<polygon points="${x},${y} ${x + 18},${y + 24} ${x},${y + 48} ${x - 18},${y + 24}" fill="${c1}"/>`
    + `<polygon points="${x},${y + 8} ${x + 10},${y + 24} ${x},${y + 40} ${x - 10},${y + 24}" fill="${c2}"/>`
    + `<circle cx="${x}" cy="${y + 24}" r="3.5" fill="#FFF3BF"/>`
    + [-6, 0, 6].map((d) => `<line x1="${x + d}" y1="${y + 46}" x2="${x + d * 1.3}" y2="${y + 66}" stroke="${c1}" stroke-width="1.6"/><circle cx="${n(x + d * 1.3)}" cy="${y + 67}" r="2" fill="${c2}"/>`).join('');
}

// Fairy lights hanging between two points.
function lights(y, sag, colors) {
  const p0 = [-10, y], p1 = [180, y + sag], p2 = [370, y];
  let out = `<path d="M${p0[0]},${p0[1]} Q${p1[0]},${p1[1]} ${p2[0]},${p2[1]}" stroke="#5C3A1E" stroke-width="1.4" fill="none"/>`;
  for (let i = 1; i < 18; i++) {
    const [bx, by] = quad(p0, p1, p2, i / 18);
    const c = colors[i % colors.length];
    out += `<circle cx="${n(bx)}" cy="${n(by + 6)}" r="7" fill="${c}" fill-opacity="0.25"/><circle cx="${n(bx)}" cy="${n(by + 6)}" r="3.4" fill="${c}"/>`;
  }
  return out;
}

// Marigold toran: swags of orange/yellow flowers with leaves.
function toran(colors) {
  let out = '<line x1="0" y1="4" x2="360" y2="4" stroke="#6B3A10" stroke-width="2"/>';
  const swags = 4, w = 360 / swags;
  for (let s = 0; s < swags; s++) {
    const p0 = [s * w, 4], p2 = [(s + 1) * w, 4], p1 = [s * w + w / 2, 62];
    for (let i = 0; i <= 14; i++) {
      const [fx, fy] = quad(p0, p1, p2, i / 14);
      out += `<circle cx="${n(fx)}" cy="${n(fy)}" r="7.5" fill="${colors[i % colors.length]}"/><circle cx="${n(fx)}" cy="${n(fy)}" r="2.6" fill="#B35C00" fill-opacity="0.55"/>`;
    }
    const jx = s * w;
    if (s > 0) {
      for (let k = 0; k < 4; k++) out += `<circle cx="${jx}" cy="${12 + k * 13}" r="6.5" fill="${colors[(k + 1) % colors.length]}"/>`;
      out += `<path d="M${jx},${66} q-7,10 0,22 q7,-12 0,-22 Z" fill="#2F9E44"/>`;
    }
  }
  for (let i = 0; i < 9; i++) {
    const x = 20 + i * 40;
    out += `<path d="M${x},6 q-6,9 0,20 q6,-11 0,-20 Z" fill="#37B24D"/>`;
  }
  return out;
}

function dandiya(x, y, angle, c1, c2) {
  let bands = '';
  for (let i = 0; i < 6; i++) bands += `<rect x="-4" y="${-66 + i * 22}" width="8" height="11" fill="${c2}"/>`;
  return `<g transform="translate(${x} ${y}) rotate(${angle})"><rect x="-4" y="-70" width="8" height="140" rx="4" fill="${c1}"/>${bands}<circle cx="0" cy="-70" r="5" fill="#FAB005"/><circle cx="0" cy="70" r="5" fill="#FAB005"/></g>`;
}

function balloon(x, y, c, s) {
  return `<path d="M${x},${n(y + 27 * s)} q${n(-8 * s)},${n(30 * s)} ${n(4 * s)},${n(70 * s)}" stroke="#868E96" stroke-width="1.2" fill="none"/>`
    + `<ellipse cx="${x}" cy="${y}" rx="${n(22 * s)}" ry="${n(27 * s)}" fill="${c}"/>`
    + `<ellipse cx="${n(x - 8 * s)}" cy="${n(y - 9 * s)}" rx="${n(5 * s)}" ry="${n(9 * s)}" fill="#FFFFFF" fill-opacity="0.38" transform="rotate(-25 ${n(x - 8 * s)} ${n(y - 9 * s)})"/>`
    + `<polygon points="${x},${n(y + 26 * s)} ${n(x - 4 * s)},${n(y + 32 * s)} ${n(x + 4 * s)},${n(y + 32 * s)}" fill="${c}"/>`;
}

const cloud = (x, y, s, o) =>
  `<g fill="#FFFFFF" fill-opacity="${o ?? 0.9}"><circle cx="${x}" cy="${y}" r="${n(18 * s)}"/><circle cx="${n(x + 20 * s)}" cy="${n(y - 8 * s)}" r="${n(22 * s)}"/><circle cx="${n(x + 42 * s)}" cy="${y}" r="${n(17 * s)}"/><rect x="${x}" y="${y}" width="${n(42 * s)}" height="${n(17 * s)}"/></g>`;

function pine(x, base, h, snow) {
  const w = h * 0.42;
  let out = `<rect x="${n(x - 4)}" y="${n(base - 8)}" width="8" height="12" fill="#5C3A1E"/>`;
  for (let i = 0; i < 3; i++) {
    const top = base - h + i * h * 0.26, bot = base - h * 0.55 + i * h * 0.24, ww = w * (0.6 + i * 0.25);
    out += `<polygon points="${x},${n(top)} ${n(x + ww)},${n(bot)} ${n(x - ww)},${n(bot)}" fill="#1B5E33"/>`;
    if (snow) out += `<polygon points="${x},${n(top)} ${n(x + ww * 0.35)},${n(top + (bot - top) * 0.35)} ${n(x - ww * 0.35)},${n(top + (bot - top) * 0.35)}" fill="#FFFFFF" fill-opacity="0.9"/>`;
  }
  return out;
}

function bauble(x, len, c) {
  return `<line x1="${x}" y1="0" x2="${x}" y2="${len}" stroke="#C9A227" stroke-width="1.3"/>`
    + `<rect x="${x - 4}" y="${len - 2}" width="8" height="6" rx="1.5" fill="#E9C46A"/>`
    + `<circle cx="${x}" cy="${len + 16}" r="14" fill="${c}"/>`
    + `<circle cx="${x - 5}" cy="${len + 11}" r="4" fill="#FFFFFF" fill-opacity="0.45"/>`
    + `<path d="M${x - 13},${len + 18} q13,6 26,0" stroke="#FFFFFF" stroke-opacity="0.5" stroke-width="2" fill="none"/>`;
}

function burst(cx, cy, R, c) {
  let out = `<circle cx="${cx}" cy="${cy}" r="${n(R * 0.18)}" fill="${c}" fill-opacity="0.9"/>`;
  for (let i = 0; i < 16; i++) {
    const a = (i * Math.PI) / 8;
    const x1 = cx + Math.cos(a) * R * 0.3, y1 = cy + Math.sin(a) * R * 0.3;
    const x2 = cx + Math.cos(a) * R, y2 = cy + Math.sin(a) * R;
    out += `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" stroke="${c}" stroke-width="2.2" stroke-linecap="round"/><circle cx="${n(x2 + Math.cos(a) * 6)}" cy="${n(y2 + Math.sin(a) * 6)}" r="2" fill="${c}"/>`;
  }
  return out;
}

function skyline(base, color, lit) {
  const blds = [[0, 70, 46], [44, 110, 34], [76, 84, 40], [114, 140, 30], [142, 96, 44], [184, 124, 36], [218, 78, 42], [258, 150, 30], [286, 100, 40], [324, 120, 36]];
  let out = '';
  blds.forEach(([x, h, w], bi) => {
    out += `<rect x="${x}" y="${base - h}" width="${w}" height="${h}" fill="${color}"/>`;
    for (let r = 0; r < Math.floor((h - 14) / 14); r++) {
      for (let c = 0; c < Math.floor((w - 8) / 10); c++) {
        if ((r * 7 + c * 3 + bi) % 3 === 0) out += `<rect x="${x + 6 + c * 10}" y="${base - h + 10 + r * 14}" width="5" height="7" fill="${lit}"/>`;
      }
    }
  });
  return out;
}

function chakra(cx, cy, R, c) {
  let out = `<circle cx="${cx}" cy="${cy}" r="${R}" stroke="${c}" stroke-width="3" fill="none"/><circle cx="${cx}" cy="${cy}" r="${n(R * 0.16)}" fill="${c}"/>`;
  for (let i = 0; i < 24; i++) {
    const a = (i * Math.PI) / 12;
    out += `<line x1="${cx}" y1="${cy}" x2="${n(cx + Math.cos(a) * R)}" y2="${n(cy + Math.sin(a) * R)}" stroke="${c}" stroke-width="1.4"/>`;
  }
  return out;
}

const blob = (cx, cy, R, c, o) => {
  let d = '';
  for (let i = 0; i <= 12; i++) {
    const a = (i * Math.PI) / 6, rr = R * (0.78 + ((i * 37) % 7) * 0.06);
    d += `${i ? 'L' : 'M'}${n(cx + Math.cos(a) * rr)},${n(cy + Math.sin(a) * rr)} `;
  }
  let dots = '';
  for (let i = 0; i < 6; i++) {
    const a = i * 1.05 + 0.3, rr = R * 1.25 + (i % 3) * 6;
    dots += `<circle cx="${n(cx + Math.cos(a) * rr)}" cy="${n(cy + Math.sin(a) * rr)}" r="${3 + (i % 3) * 2}" fill="${c}" fill-opacity="${o ?? 0.85}"/>`;
  }
  return `<path d="${d}Z" fill="${c}" fill-opacity="${o ?? 0.85}"/>${dots}`;
};

function modak(x, y, s) {
  return `<path d="M${x},${n(y - 34 * s)} C${n(x + 6 * s)},${n(y - 22 * s)} ${n(x + 22 * s)},${n(y - 10 * s)} ${n(x + 20 * s)},${y} L${n(x - 20 * s)},${y} C${n(x - 22 * s)},${n(y - 10 * s)} ${n(x - 6 * s)},${n(y - 22 * s)} ${x},${n(y - 34 * s)} Z" fill="#FFF4E6"/>`
    + [-12, -6, 0, 6, 12].map((d) => `<path d="M${x},${n(y - 32 * s)} Q${n(x + d * 1.2 * s)},${n(y - 14 * s)} ${n(x + d * 1.4 * s)},${y}" stroke="#E8C9A0" stroke-width="1.2" fill="none"/>`).join('');
}

function lotus(cx, base, s) {
  const petal = (a, c) => `<path d="M${cx},${base} C${n(cx - 16 * s)},${n(base - 30 * s)} ${n(cx - 8 * s)},${n(base - 56 * s)} ${cx},${n(base - 66 * s)} C${n(cx + 8 * s)},${n(base - 56 * s)} ${n(cx + 16 * s)},${n(base - 30 * s)} ${cx},${base} Z" fill="${c}" transform="rotate(${a} ${cx} ${base})"/>`;
  return [-64, 64, -42, 42, -20, 20, 0].map((a, i) => petal(a, i < 2 ? '#F783AC' : i < 4 ? '#F06595' : i < 6 ? '#E64980' : '#FFDEEB')).join('');
}

function gift(x, base, w, h, c, ribbon) {
  return `<rect x="${x}" y="${base - h}" width="${w}" height="${h}" rx="3" fill="${c}"/>`
    + `<rect x="${x - 3}" y="${base - h - 8}" width="${w + 6}" height="12" rx="2" fill="${c}"/>`
    + `<rect x="${x + w / 2 - 4}" y="${base - h - 8}" width="8" height="${h + 8}" fill="${ribbon}"/>`
    + `<path d="M${x + w / 2},${base - h - 8} q-16,-18 -20,-4 q4,10 20,4 Z M${x + w / 2},${base - h - 8} q16,-18 20,-4 q-4,10 -20,4 Z" fill="${ribbon}"/>`;
}

const heart = (x, y, s, c, o) =>
  `<path d="M${x},${n(y + 8 * s)} C${n(x - 14 * s)},${n(y - 2 * s)} ${n(x - 8 * s)},${n(y - 14 * s)} ${x},${n(y - 6 * s)} C${n(x + 8 * s)},${n(y - 14 * s)} ${n(x + 14 * s)},${n(y - 2 * s)} ${x},${n(y + 8 * s)} Z" fill="${c}" fill-opacity="${o ?? 1}"/>`;

function waves(base, colors) {
  return colors.map((c, i) => {
    const y = base - 120 + i * 34;
    return `<path d="M0,${y} C90,${y - 30} 150,${y + 30} 240,${y} S330,${y - 24} 360,${y - 6} L360,240 L0,240 Z" fill="${c}"/>`;
  }).join('');
}

function confetti(colors, count, maxY) {
  let out = '';
  for (let i = 0; i < count; i++) {
    const x = (i * 53 + 17) % 350 + 5, y = (i * 29 + 11) % maxY + 5, c = colors[i % colors.length];
    out += i % 3 === 0 ? star(x, y, 5, 2.2, c, 0.85) : `<rect x="${x}" y="${y}" width="6" height="3" rx="1" fill="${c}" fill-opacity="0.85" transform="rotate(${(i * 47) % 180} ${x} ${y})"/>`;
  }
  return out;
}

// Patang (kite) with a curly tail and little bows — Makar Sankranti.
function kite(x, y, s, c1, c2, rot) {
  return `<g transform="translate(${x} ${y}) rotate(${rot || 0}) scale(${s})">`
    + '<polygon points="0,-30 22,0 0,34 -22,0" fill="' + c1 + '"/>'
    + '<polygon points="0,-30 22,0 0,0" fill="' + c2 + '" fill-opacity="0.9"/>'
    + '<polygon points="0,34 -22,0 0,0" fill="' + c2 + '" fill-opacity="0.9"/>'
    + '<path d="M0,-30 L0,34 M-22,0 L22,0" stroke="#5C3A1E" stroke-opacity="0.45" stroke-width="1.2"/>'
    + `<path d="M0,34 q-9,13 1,25 q10,12 -1,24" stroke="${c1}" stroke-width="1.6" fill="none"/>`
    + `<path d="M-5,52 L5,60 L5,52 L-5,60 Z M-4,74 L6,82 L6,74 L-4,82 Z" fill="${c2}"/>`
    + '</g>';
}

// Kite string (manjha) drifting down to the edge.
const manjha = (x1, y1, x2, y2) =>
  `<path d="M${x1},${y1} Q${n((x1 + x2) / 2 + 30)},${n((y1 + y2) / 2 - 10)} ${x2},${y2}" stroke="#FFFFFF" stroke-opacity="0.75" stroke-width="1" fill="none"/>`;

// Sun with soft glow and rays.
function sun(cx, cy, R, c) {
  let rays = '';
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    const x1 = cx + Math.cos(a) * R * 1.25, y1 = cy + Math.sin(a) * R * 1.25;
    const x2 = cx + Math.cos(a) * R * 1.7, y2 = cy + Math.sin(a) * R * 1.7;
    rays += `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" stroke="${c}" stroke-width="3" stroke-linecap="round"/>`;
  }
  return `<circle cx="${cx}" cy="${cy}" r="${n(R * 2.2)}" fill="url(#sunglow)"/>${rays}`
    + `<circle cx="${cx}" cy="${cy}" r="${R}" fill="${c}"/><circle cx="${n(cx - R * 0.3)}" cy="${n(cy - R * 0.3)}" r="${n(R * 0.35)}" fill="#FFFFFF" fill-opacity="0.35"/>`;
}

// Sugarcane stalk with leaves.
function sugarcane(x, base, h, lean) {
  let out = `<g transform="rotate(${lean} ${x} ${base})">`;
  for (let y = base; y > base - h; y -= 18) out += `<rect x="${x - 4}" y="${y - 17}" width="8" height="17" rx="2" fill="#7B5E9E"/><rect x="${x - 4}" y="${y - 2}" width="8" height="2.5" fill="#E9D8FD"/>`;
  out += `<path d="M${x},${base - h} q-26,-6 -40,8 q20,-2 40,-8 Z M${x},${base - h} q24,-12 40,-2 q-22,-4 -40,2 Z M${x},${base - h + 14} q-20,4 -30,20 q14,-12 30,-20 Z" fill="#40C057"/>`;
  return out + '</g>';
}

// Earthen pot (matki / pongal pot) with a painted band.
function matki(x, base, s, c, band) {
  const r = 26 * s;
  return `<ellipse cx="${x}" cy="${n(base - r)}" rx="${n(r * 1.1)}" ry="${r}" fill="${c}"/>`
    + `<rect x="${n(x - r * 0.5)}" y="${n(base - r * 2.25)}" width="${n(r)}" height="${n(r * 0.4)}" fill="${c}"/>`
    + `<rect x="${n(x - r * 0.62)}" y="${n(base - r * 2.4)}" width="${n(r * 1.24)}" height="${n(r * 0.22)}" rx="${n(r * 0.1)}" fill="${band}"/>`
    + `<path d="M${n(x - r * 1.04)},${n(base - r * 1.15)} Q${x},${n(base - r * 0.8)} ${n(x + r * 1.04)},${n(base - r * 1.15)}" stroke="${band}" stroke-width="${n(4 * s)}" fill="none"/>`
    + `<circle cx="${n(x - r * 0.4)}" cy="${n(base - r * 0.7)}" r="${n(2.5 * s)}" fill="${band}"/><circle cx="${n(x + r * 0.4)}" cy="${n(base - r * 0.7)}" r="${n(2.5 * s)}" fill="${band}"/>`;
}

// Til-gud laddoos piled up.
const laddoos = (x, base) => [[-14, 0], [0, 0], [14, 0], [-7, -12], [7, -12], [0, -24]]
  .map(([dx, dy]) => `<circle cx="${x + dx}" cy="${base - 7 + dy}" r="7" fill="#E8A33D"/><circle cx="${x + dx - 2}" cy="${base - 9 + dy}" r="1.2" fill="#FFF3BF"/>`).join('');

// Peacock feather — Janmashtami.
function feather(x, y, len, rot) {
  let barbs = '';
  for (let i = 0; i < 9; i++) {
    const t = 0.2 + i * 0.08, yy = -len * t;
    barbs += `<path d="M0,${n(yy)} q-14,-4 -18,-14 M0,${n(yy)} q14,-4 18,-14" stroke="#2B8A3E" stroke-opacity="0.75" stroke-width="1.2" fill="none"/>`;
  }
  const ey = -len * 0.92;
  return `<g transform="translate(${x} ${y}) rotate(${rot})">`
    + `<path d="M0,0 L0,${n(-len)}" stroke="#5C940D" stroke-width="2"/>${barbs}`
    + `<ellipse cx="0" cy="${n(ey)}" rx="17" ry="24" fill="#2B8A3E"/><ellipse cx="0" cy="${n(ey + 2)}" rx="12" ry="17" fill="#FAB005"/>`
    + `<ellipse cx="0" cy="${n(ey + 4)}" rx="8.5" ry="12" fill="#1971C2"/><ellipse cx="0" cy="${n(ey + 6)}" rx="4.5" ry="6.5" fill="#0B1F4D"/>`
    + '</g>';
}

// Bansuri (flute) with a tassel.
function flute(x, y, len, rot) {
  let holes = '';
  for (let i = 0; i < 6; i++) holes += `<circle cx="${n(len * 0.35 + i * 12)}" cy="0" r="2.2" fill="#5C3A1E"/>`;
  return `<g transform="translate(${x} ${y}) rotate(${rot})">`
    + `<rect x="0" y="-5" width="${len}" height="10" rx="5" fill="#C08A3E"/><rect x="${n(len * 0.12)}" y="-5" width="5" height="10" fill="#E03131"/><rect x="${n(len * 0.88)}" y="-5" width="5" height="10" fill="#E03131"/>${holes}`
    + `<path d="M${n(len * 0.14)},5 q-4,16 2,30 M${n(len * 0.14)},5 q4,16 6,28" stroke="#FAB005" stroke-width="2" fill="none"/>`
    + '</g>';
}

// Stack of books.
function books(x, base, colors) {
  return colors.map((c, i) => {
    const w = 64 - i * 6, h = 13, y = base - (i + 1) * h, off = (i % 2 ? 4 : -3);
    return `<rect x="${x - w / 2 + off}" y="${y}" width="${w}" height="${h - 1}" rx="2" fill="${c}"/><rect x="${x - w / 2 + off + 4}" y="${y + 3}" width="${w - 8}" height="2" fill="#FFFFFF" fill-opacity="0.55"/>`;
  }).join('');
}

function pencil(x, y, len, rot, c) {
  return `<g transform="translate(${x} ${y}) rotate(${rot})">`
    + `<rect x="0" y="-5" width="${len}" height="10" fill="${c}"/><rect x="${len}" y="-5" width="4" height="10" fill="#ADB5BD"/><rect x="${len + 4}" y="-5" width="8" height="10" rx="2" fill="#F783AC"/>`
    + '<polygon points="0,-5 -16,0 0,5" fill="#F1D3A6"/><polygon points="-11,-1.6 -16,0 -11,1.6" fill="#343A40"/>'
    + '</g>';
}

function apple(x, y, s) {
  return `<g transform="translate(${x} ${y}) scale(${s})">`
    + '<path d="M0,-12 C-14,-22 -28,-8 -22,8 C-18,20 -8,24 0,18 C8,24 18,20 22,8 C28,-8 14,-22 0,-12 Z" fill="#E03131"/>'
    + '<path d="M0,-12 q2,-10 6,-14" stroke="#5C3A1E" stroke-width="2.4" fill="none"/><path d="M3,-20 q10,-8 16,-2 q-8,6 -16,2 Z" fill="#40C057"/>'
    + '<ellipse cx="-10" cy="-4" rx="4" ry="7" fill="#FFFFFF" fill-opacity="0.35" transform="rotate(20 -10 -4)"/></g>';
}

function gradCap(x, y, s) {
  return `<g transform="translate(${x} ${y}) scale(${s})">`
    + '<path d="M-16,4 L-16,16 Q0,26 16,16 L16,4 Z" fill="#212529"/>'
    + '<polygon points="0,-14 36,0 0,14 -36,0" fill="#343A40"/>'
    + '<path d="M0,0 L26,8 L26,26" stroke="#FAB005" stroke-width="2" fill="none"/><circle cx="26" cy="28" r="3.5" fill="#FAB005"/></g>';
}

function iceCream(x, base, s, scoops) {
  let out = `<g transform="translate(${x} ${base}) scale(${s})">`
    + '<polygon points="-14,-34 14,-34 0,0" fill="#E8A33D"/><path d="M-10,-28 L6,-10 M-2,-34 L10,-22 M6,-34 L-6,-14" stroke="#B5722A" stroke-width="1.2"/>';
  scoops.forEach((c, i) => { out += `<circle cx="${i % 2 ? 4 : -4}" cy="${-42 - i * 15}" r="14" fill="${c}"/>`; });
  return out + `<circle cx="0" cy="${-58 - (scoops.length - 1) * 15}" r="4" fill="#E03131"/></g>`;
}

function beachBall(x, y, R) {
  return `<circle cx="${x}" cy="${y}" r="${R}" fill="#FFFFFF"/>`
    + `<path d="M${x},${y - R} A${R},${R} 0 0,1 ${x + R},${y} L${x},${y} Z" fill="#E03131"/>`
    + `<path d="M${x},${y + R} A${R},${R} 0 0,1 ${x - R},${y} L${x},${y} Z" fill="#1C7ED6"/>`
    + `<path d="M${x + R},${y} A${R},${R} 0 0,1 ${x},${y + R} L${x},${y} Z" fill="#FAB005"/>`
    + `<circle cx="${x}" cy="${y}" r="${n(R * 0.18)}" fill="#FFFFFF"/>`;
}

// Six-armed snowflake with little branches.
function snowflake(cx, cy, R, o) {
  let out = `<g stroke="#FFFFFF" stroke-opacity="${o ?? 0.9}" stroke-width="${n(Math.max(1, R / 7))}" stroke-linecap="round" fill="none">`;
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3, c = Math.cos(a), s = Math.sin(a);
    const bx = cx + c * R * 0.6, by = cy + s * R * 0.6, b = R * 0.3;
    out += `<path d="M${cx},${cy} L${n(cx + c * R)},${n(cy + s * R)}`
      + ` M${n(bx)},${n(by)} L${n(bx + Math.cos(a + 0.8) * b)},${n(by + Math.sin(a + 0.8) * b)}`
      + ` M${n(bx)},${n(by)} L${n(bx + Math.cos(a - 0.8) * b)},${n(by + Math.sin(a - 0.8) * b)}"/>`;
  }
  return out + '</g>';
}

// Snowman with a woolly hat and scarf; (x, base) = bottom centre.
function snowman(x, base, s) {
  return `<g transform="translate(${x} ${base}) scale(${s})">`
    + '<ellipse cx="0" cy="-2" rx="44" ry="6" fill="#A5D8FF" fill-opacity="0.6"/>'
    + '<circle cx="0" cy="-34" r="34" fill="#FFFFFF"/><circle cx="0" cy="-90" r="25" fill="#FFFFFF"/>'
    + '<circle cx="-8" cy="-95" r="3" fill="#212529"/><circle cx="8" cy="-95" r="3" fill="#212529"/>'
    + '<polygon points="0,-89 18,-85 0,-83" fill="#F76707"/>'
    + '<path d="M-9,-80 q9,6 18,0" stroke="#212529" stroke-width="2" fill="none" stroke-linecap="round"/>'
    + '<path d="M-25,-70 Q0,-60 25,-70 L25,-62 Q0,-52 -25,-62 Z" fill="#E03131"/><rect x="10" y="-66" width="9" height="28" rx="3" fill="#E03131"/>'
    + '<path d="M-22,-104 Q0,-140 22,-104 Z" fill="#1971C2"/><rect x="-24" y="-108" width="48" height="9" rx="4" fill="#FFFFFF"/><circle cx="0" cy="-130" r="7" fill="#FFFFFF"/>'
    + '<circle cx="0" cy="-44" r="3" fill="#212529"/><circle cx="0" cy="-30" r="3" fill="#212529"/>'
    + '<path d="M-32,-48 L-58,-66 M-46,-57 L-50,-70 M32,-48 L58,-66 M46,-57 L54,-68" stroke="#7A4A22" stroke-width="3" stroke-linecap="round"/>'
    + '</g>';
}

// Hot chocolate mug with steam.
function mug(x, base, s) {
  return `<g transform="translate(${x} ${base}) scale(${s})">`
    + '<rect x="-20" y="-40" width="40" height="40" rx="6" fill="#E03131"/><rect x="-20" y="-30" width="40" height="6" fill="#FFFFFF" fill-opacity="0.85"/>'
    + '<path d="M20,-32 q16,0 16,12 q0,12 -16,12" stroke="#E03131" stroke-width="6" fill="none"/>'
    + '<ellipse cx="0" cy="-40" rx="20" ry="5" fill="#7A4A22"/>'
    + '<path d="M-8,-50 q-6,-10 0,-20 M4,-50 q-6,-10 0,-20" stroke="#FFFFFF" stroke-opacity="0.8" stroke-width="2.4" fill="none" stroke-linecap="round"/>'
    + '</g>';
}

// Triangle flag garland along a curve (party bunting).
function flagGarland(y, sag, colors, flags) {
  const p0 = [-10, y], p1 = [180, y + sag], p2 = [370, y];
  let out = `<path d="M${p0[0]},${p0[1]} Q${p1[0]},${p1[1]} ${p2[0]},${p2[1]}" stroke="#FFFFFF" stroke-opacity="0.8" stroke-width="1.4" fill="none"/>`;
  for (let i = 1; i < flags; i++) {
    const [fx, fy] = quad(p0, p1, p2, i / flags);
    out += `<polygon points="${n(fx - 8)},${n(fy)} ${n(fx + 8)},${n(fy)} ${n(fx)},${n(fy + 18)}" fill="${colors[i % colors.length]}"/>`;
  }
  return out;
}

// ── Header decorations ──────────────────────────────────────────────────────
// Drawn behind the home header while a festive top is live (360×110, pinned
// to the bottom, sliced to fill). Texture = faint rangoli in two corners;
// the festival's own motif sits in the free space between the title (left)
// and the bell/chat buttons (right), roughly x 190–265.
const WHITE4 = ['#FFFFFF', '#FFFFFF', '#FFFFFF', '#FFFFFF'];
const HEADER = '0 0 360 110';
const hdr = (body, defs) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${HEADER}" preserveAspectRatio="xMidYMax slice"><defs>${defs || ''}</defs>`
  + `<g opacity="0.16">${mandala(352, 30, 70, WHITE4)}</g><g opacity="0.12">${mandala(-6, 104, 46, WHITE4)}</g>`
  + star(196, 24, 4, 1.6, '#FFFFFF', 0.7) + star(270, 94, 3, 1.3, '#FFFFFF', 0.6) + star(150, 12, 3, 1.3, '#FFFFFF', 0.5)
  + `${body}</svg>`;
const at = (x, y, s, body) => `<g transform="translate(${x} ${y}) scale(${s})">${body}</g>`;

function miniToran(colors) {
  let out = '';
  for (let i = 0, x = 6; x < 360; i++, x += 12) {
    out += `<circle cx="${x}" cy="5" r="4.2" fill="${colors[i % colors.length]}"/>`;
    if (i % 3 === 1) out += `<path d="M${x},9 q-3,5 0,10 q3,-5 0,-10 Z" fill="#37B24D"/>`;
  }
  return out;
}

const HEADER_ART = {
  diwali: hdr(at(214, 0, 0.42, kandil(0, 24, '#E03131', '#FFD43B')) + at(246, 0, 0.34, kandil(0, 52, '#C2255C', '#FFF3BF')), glowDef('glow', '#FFD43B')),
  navratri: hdr(miniToran(['#FFD43B', '#FF922B', '#E8590C']) + at(230, 62, 0.3, dandiya(-16, 0, -28, '#C2255C', '#FCC419') + dandiya(16, 0, 28, '#7048E8', '#FCC419'))),
  'childrens-day': hdr(`<g opacity="0.5">${cloud(186, 84, 0.6)}</g>` + balloon(222, 36, '#FCC419', 0.55) + balloon(250, 50, '#F06595', 0.5)),
  christmas: hdr(at(212, 0, 0.5, bauble(0, 18, '#E03131')) + at(246, 0, 0.42, bauble(0, 34, '#FAB005')) + [[186, 30], [232, 92], [262, 18], [168, 70]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.2" fill="#FFFFFF" fill-opacity="0.85"/>`).join('')),
  'new-year': hdr(burst(220, 42, 20, '#FFD43B') + burst(254, 74, 13, '#F06595') + burst(192, 82, 9, '#74C0FC')),
  national: hdr(`<g opacity="0.55">${chakra(232, 56, 18, '#FFFFFF')}</g>` + '<path d="M186,92 C206,84 240,100 262,88" stroke="#FFFFFF" stroke-opacity="0.4" stroke-width="3" stroke-linecap="round" fill="none"/>'),
  holi: hdr(blob(224, 36, 8, '#FCC419', 0.8) + blob(246, 76, 6, '#51CF66', 0.75) + blob(200, 80, 5, '#339AF0', 0.75) + blob(196, 24, 4, '#845EF7', 0.75)),
  ganesh: hdr(miniToran(['#FF922B', '#E03131', '#FCC419']) + at(228, 108, 0.62, lotus(0, 0, 1))),
  rakhi: hdr('<path d="M182,58 Q226,92 268,54" stroke="#FFD43B" stroke-width="3" fill="none"/><path d="M182,63 Q226,97 268,59" stroke="#E03131" stroke-width="1.5" fill="none"/>' + mandala(226, 78, 15, ['#FAB005', '#E64980', '#7048E8', '#FFFFFF'])),
  sankranti: hdr(sun(250, 30, 9, '#FFD43B') + manjha(214, 70, 360, 110) + kite(214, 46, 0.55, '#E64980', '#FFD43B', -14) + kite(186, 82, 0.34, '#4C6EF5', '#FFFFFF', 12), glowDef('sunglow', '#FFE066')),
  janmashtami: hdr(feather(258, 108, 70, -24) + at(212, 0, 0.6, '<line x1="0" y1="0" x2="0" y2="30" stroke="#FFFFFF" stroke-opacity="0.8" stroke-width="1.5"/>' + matki(0, 80, 0.9, '#C2410C', '#FCC419') + '<ellipse cx="0" cy="34" rx="16" ry="6" fill="#FFFFFF"/>')),
  winter: hdr(snowflake(206, 30, 9, 0.9) + snowflake(262, 22, 6, 0.75) + snowflake(240, 88, 5, 0.7) + snowman(234, 108, 0.42)),
  'teachers-day': hdr(gradCap(214, 46, 0.55) + pencil(236, 86, 34, -18, '#FAB005') + apple(262, 40, 0.5)),
  summer: hdr(sun(236, 44, 12, '#FFD43B') + iceCream(198, 104, 0.5, ['#F783AC', '#FFF3BF']), glowDef('sunglow', '#FFE066')),
  celebration: hdr(flagGarland(6, 26, ['#FFD43B', '#F06595', '#74C0FC', '#63E6BE'], 12) + balloon(226, 52, '#F06595', 0.45) + balloon(250, 66, '#FCC419', 0.4)),
  everyday: hdr(confettiIn(178, 268, ['#FFFFFF', '#FFD43B', '#63E6BE'], 12)),
};

// Confetti kept to a horizontal strip (the header's free middle).
function confettiIn(x0, x1, colors, count) {
  let out = '';
  for (let i = 0; i < count; i++) {
    const x = x0 + ((i * 37) % (x1 - x0)), y = 10 + ((i * 29) % 90), c = colors[i % colors.length];
    out += i % 3 === 0 ? star(x, y, 4.5, 2, c, 0.85) : `<rect x="${x}" y="${y}" width="6" height="3" rx="1" fill="${c}" fill-opacity="0.85" transform="rotate(${(i * 47) % 180} ${x} ${y})"/>`;
  }
  return out;
}

// ── Templates ───────────────────────────────────────────────────────────────
const TOP = '0 0 360 200';
const BOTTOM = '0 0 360 240';

function build() {
  return {
    diwali: {
      name: 'Diwali — diyas & lanterns', emoji: '🪔',
      top: svg(TOP, lights(6, 34, ['#FFD43B', '#FF922B', '#FF6B6B', '#FFF3BF']) + kandil(60, 40, '#E03131', '#FFD43B') + kandil(180, 64, '#F76707', '#FFF3BF') + kandil(300, 40, '#C2255C', '#FFD43B'), glowDef('glow', '#FFD43B')),
      bottom: svg(BOTTOM, mandala(180, 250, 150, ['#F76707', '#FFD43B', '#E64980', '#C2255C']) + [50, 115, 180, 245, 310].map((x, i) => diya(x, 196 - (i === 2 ? 14 : i % 2 ? 6 : 0), i === 2 ? 1.25 : 1)).join(''), glowDef('glow', '#FFD43B')),
    },
    navratri: {
      name: 'Navratri — marigold & dandiya', emoji: '🥢',
      top: svg(TOP, toran(['#FF922B', '#FCC419', '#F76707'])),
      bottom: svg(BOTTOM, mandala(180, 250, 140, ['#E64980', '#FCC419', '#F76707', '#C2255C']) + dandiya(52, 160, -28, '#C2255C', '#FCC419') + dandiya(78, 160, 28, '#7048E8', '#FCC419') + dandiya(282, 160, -28, '#7048E8', '#FCC419') + dandiya(308, 160, 28, '#C2255C', '#FCC419')),
    },
    'childrens-day': {
      name: "Children's Day — balloons", emoji: '🎈',
      top: svg(TOP, cloud(20, 60, 1, 0.7) + cloud(250, 40, 1.2, 0.7) + confetti(['#FFD43B', '#FFFFFF', '#F06595', '#51CF66'], 22, 150)),
      bottom: svg(BOTTOM, cloud(-10, 210, 1.6) + cloud(250, 205, 1.8) + [[60, 120, '#F06595', 1], [110, 90, '#FCC419', 1.15], [250, 95, '#51CF66', 1.1], [300, 125, '#339AF0', 1], [180, 130, '#FF6B6B', 0.9]].map(([x, y, c, s]) => balloon(x, y, c, s)).join('') + cloud(120, 225, 1.5)),
    },
    christmas: {
      name: 'Christmas — ornaments & snowy trees', emoji: '🎄',
      top: svg(TOP, '<path d="M0,6 Q180,40 360,6" stroke="#2B8A3E" stroke-width="5" fill="none"/>' + bauble(50, 30, '#E03131') + bauble(120, 48, '#FAB005') + bauble(240, 48, '#E03131') + bauble(310, 30, '#FAB005') + star(180, 54, 18, 8, '#FFD43B')),
      bottom: svg(BOTTOM, '<path d="M0,170 C80,140 140,180 220,160 S320,140 360,150 L360,240 L0,240 Z" fill="#E7F5FF"/>' + pine(40, 200, 110, true) + pine(90, 190, 80, true) + pine(300, 200, 120, true) + pine(256, 194, 76, true) + pine(180, 214, 150, true) + star(180, 66, 12, 5, '#FFD43B') + ['#E03131', '#FAB005', '#4DABF7', '#E03131', '#FAB005'].map((c, i) => `<circle cx="${[166, 196, 160, 202, 180][i]}" cy="${[118, 128, 154, 160, 140][i]}" r="5" fill="${c}"/>`).join('') + '<path d="M0,205 C90,186 170,222 260,200 S340,196 360,200 L360,240 L0,240 Z" fill="#FFFFFF"/>'),
    },
    'new-year': {
      name: 'New Year — fireworks & city', emoji: '🎆',
      top: svg(TOP, burst(70, 70, 46, '#FFD43B') + burst(250, 50, 38, '#F06595') + burst(320, 130, 28, '#74C0FC') + burst(150, 140, 24, '#B197FC') + confetti(['#FFD43B', '#F06595', '#FFFFFF'], 14, 190)),
      bottom: svg(BOTTOM, skyline(240, '#160B3A', '#FFD43B') + confetti(['#FFD43B', '#F06595', '#74C0FC'], 10, 80)),
    },
    national: {
      name: 'Independence / Republic Day — tricolour', emoji: '🇮🇳',
      top: svg(TOP, '<path d="M0,0 L360,0 L360,46 C260,80 120,20 0,60 Z" fill="#FF9933"/><path d="M0,60 C120,20 260,80 360,46 L360,64 C260,98 120,38 0,78 Z" fill="#FFFFFF"/><path d="M0,78 C120,38 260,98 360,64 L360,84 C260,118 120,58 0,98 Z" fill="#138808"/>'),
      bottom: svg(BOTTOM, `<g opacity="0.18">${chakra(180, 120, 70, '#000080')}</g><path d="M0,150 C120,190 240,120 360,160 L360,182 C240,142 120,212 0,172 Z" fill="#FF9933"/><path d="M0,172 C120,212 240,142 360,182 L360,200 C240,160 120,230 0,190 Z" fill="#FFFFFF"/><path d="M0,190 C120,230 240,160 360,200 L360,240 L0,240 Z" fill="#138808"/>${chakra(180, 186, 13, '#000080')}`),
    },
    holi: {
      name: 'Holi — colour splashes', emoji: '🎨',
      top: svg(TOP, blob(40, 30, 46, '#F06595') + blob(150, -6, 40, '#FCC419') + blob(260, 26, 50, '#845EF7') + blob(345, 110, 34, '#51CF66') + blob(10, 140, 26, '#339AF0')),
      bottom: svg(BOTTOM, blob(30, 220, 60, '#51CF66') + blob(130, 240, 56, '#FF6B6B') + blob(240, 226, 62, '#339AF0') + blob(340, 210, 48, '#FCC419') + blob(190, 150, 22, '#F06595', 0.7)),
    },
    ganesh: {
      name: 'Ganesh Chaturthi — marigold, lotus & modak', emoji: '🌺',
      top: svg(TOP, toran(['#FF922B', '#E03131', '#FCC419'])),
      bottom: svg(BOTTOM, mandala(180, 260, 150, ['#FCC419', '#F76707', '#E03131', '#C92A2A']) + lotus(180, 226, 1.4) + '<ellipse cx="70" cy="214" rx="50" ry="10" fill="#C9A227"/><ellipse cx="290" cy="214" rx="50" ry="10" fill="#C9A227"/>' + modak(52, 210, 0.9) + modak(88, 210, 0.9) + modak(70, 194, 0.8) + modak(272, 210, 0.9) + modak(308, 210, 0.9) + modak(290, 194, 0.8)),
    },
    rakhi: {
      name: 'Raksha Bandhan — rakhi & gifts', emoji: '🎁',
      top: svg(TOP, '<path d="M0,70 Q180,110 360,70" stroke="#E03131" stroke-width="5" fill="none"/><path d="M0,76 Q180,116 360,76" stroke="#FAB005" stroke-width="2" fill="none"/>' + mandala(180, 92, 54, ['#FAB005', '#E64980', '#7048E8', '#FFFFFF']) + heart(40, 150, 1, '#FFFFFF', 0.5) + heart(320, 140, 1.3, '#FFFFFF', 0.5)),
      bottom: svg(BOTTOM, gift(30, 236, 70, 60, '#7048E8', '#FCC419') + gift(110, 236, 50, 40, '#E64980', '#FFFFFF') + gift(206, 236, 54, 46, '#FCC419', '#E03131') + gift(272, 236, 66, 70, '#E03131', '#FCC419') + heart(180, 120, 1.6, '#FFFFFF', 0.6) + heart(150, 160, 1, '#FFFFFF', 0.5) + heart(220, 150, 1.1, '#FFFFFF', 0.5)),
    },
    sankranti: {
      name: 'Makar Sankranti — kites & sun', emoji: '🪁',
      top: svg(TOP, sun(296, 52, 22, '#FFD43B')
        + manjha(70, 92, 0, 200) + manjha(176, 66, 120, 200) + manjha(236, 150, 360, 200)
        + kite(70, 60, 1, '#E64980', '#FFD43B', -14) + kite(176, 40, 0.8, '#4C6EF5', '#FFFFFF', 10)
        + kite(236, 128, 0.6, '#2F9E44', '#FCC419', -8) + kite(330, 150, 0.42, '#F76707', '#FFFFFF', 16),
      glowDef('sunglow', '#FFE066')),
      bottom: svg(BOTTOM, '<path d="M0,196 C110,170 250,206 360,184 L360,240 L0,240 Z" fill="#FFE8CC" fill-opacity="0.9"/>'
        + sugarcane(28, 240, 150, -6) + sugarcane(48, 240, 120, 8) + sugarcane(332, 240, 150, 6) + sugarcane(312, 240, 120, -8)
        + matki(180, 236, 1.5, '#B5541C', '#FCC419') + laddoos(118, 236) + laddoos(242, 236)),
    },
    janmashtami: {
      name: 'Janmashtami — peacock feather & flute', emoji: '🦚',
      top: svg(TOP, lights(6, 30, ['#FFD43B', '#FFFFFF', '#74C0FC'])
        + '<line x1="180" y1="0" x2="180" y2="64" stroke="#FFFFFF" stroke-opacity="0.85" stroke-width="2"/>'
        + matki(180, 128, 1.2, '#C2410C', '#FCC419') + '<ellipse cx="180" cy="70" rx="20" ry="8" fill="#FFFFFF"/>'
        + feather(20, 0, 120, 150) + feather(340, 0, 120, -150)),
      bottom: svg(BOTTOM, `<g opacity="0.35">${mandala(180, 260, 140, ['#1971C2', '#FCC419', '#2B8A3E', '#FFFFFF'])}</g>`
        + feather(70, 240, 150, 28) + feather(290, 240, 150, -28) + flute(96, 200, 170, -6)),
    },
    winter: {
      name: 'Winter Holidays — snowman & snowflakes', emoji: '⛄',
      top: svg(TOP, [[40, 40, 16], [120, 22, 10], [200, 60, 13], [290, 30, 18], [338, 110, 10], [80, 120, 9], [250, 140, 8], [160, 150, 6]]
        .map(([x, y, r], i) => snowflake(x, y, r, 0.6 + (i % 3) * 0.15)).join('')),
      bottom: svg(BOTTOM, '<path d="M0,170 C70,140 140,176 210,156 S320,134 360,150 L360,240 L0,240 Z" fill="#E7F5FF"/>'
        + '<path d="M0,200 C90,180 200,214 360,190 L360,240 L0,240 Z" fill="#FFFFFF"/>'
        + pine(40, 196, 90, true) + pine(320, 186, 110, true) + snowman(180, 232, 1.1) + mug(262, 230, 0.9)),
    },
    'teachers-day': {
      name: "Teachers' Day — books & pencils", emoji: '📚',
      top: svg(TOP, confetti(['#FFD43B', '#FFFFFF', '#74C0FC'], 16, 150)
        + gradCap(300, 60, 1.2) + pencil(40, 40, 70, 24, '#FAB005') + pencil(110, 24, 56, 12, '#4C6EF5')),
      bottom: svg(BOTTOM, books(70, 240, ['#E03131', '#1C7ED6', '#2F9E44', '#FAB005', '#7048E8'])
        + books(290, 240, ['#7048E8', '#FAB005', '#E03131', '#1C7ED6']) + apple(290, 162, 1.1) + apple(180, 222, 0.8)),
    },
    summer: {
      name: 'Summer Holidays — sun & beach', emoji: '☀️',
      top: svg(TOP, sun(290, 62, 28, '#FFD43B') + cloud(30, 60, 1, 0.85) + cloud(160, 34, 0.8, 0.7), glowDef('sunglow', '#FFE066')),
      bottom: svg(BOTTOM, waves(240, ['#A5D8FF', '#74C0FC', '#4DABF7', '#FFE8CC'])
        + beachBall(300, 196, 22) + iceCream(64, 222, 1.1, ['#F783AC', '#FFF3BF', '#8CE99A'])),
    },
    celebration: {
      name: 'Celebration — bunting & balloons', emoji: '🎊',
      top: svg(TOP, flagGarland(6, 40, ['#FFD43B', '#F06595', '#74C0FC', '#63E6BE', '#B197FC'], 16)
        + confetti(['#FFD43B', '#FFFFFF', '#F06595', '#74C0FC'], 18, 180)),
      bottom: svg(BOTTOM, [[50, 120, '#F06595', 1], [96, 96, '#FCC419', 1.1], [264, 100, '#74C0FC', 1.1], [310, 126, '#63E6BE', 1]].map(([x, y, c, s]) => balloon(x, y, c, s)).join('')
        + gift(140, 236, 40, 34, '#7048E8', '#FCC419') + gift(186, 236, 34, 46, '#F06595', '#FFFFFF')),
    },
    everyday: {
      name: 'Everyday — Mittmee waves', emoji: '⭐',
      top: svg(TOP, confetti(['#1FAE8E', '#3E82E0', '#F5A623', '#F0729A'], 16, 160)),
      bottom: svg(BOTTOM, waves(240, ['#A5D8FF', '#63E6BE', '#3E82E0', '#1FAE8E'])),
    },
  };
}

export const SPLASH_ART = build();
// Each template also carries its home-header decoration (festive top).
for (const id of Object.keys(SPLASH_ART)) SPLASH_ART[id].header = HEADER_ART[id];
export const SPLASH_ART_IDS = Object.keys(SPLASH_ART);
// Height of each drawing for a given width (viewBox ratios). The header
// decoration is sliced to fill whatever height the header has.
export const SPLASH_ART_TOP_RATIO = 200 / 360;
export const SPLASH_ART_BOTTOM_RATIO = 240 / 360;
