"""Builds the Holistic Progress Passport web assets from the designer's print PDF.

    python scripts/build-passport-assets.py "public/uploads/Junior Olympiad Passport Book (Junior Power Quest)_Nursery 1.pdf"

Needs poppler (pdftoppm, pdftocairo, pdfimages) on PATH, plus Pillow, numpy
and scipy. Writes to public/passport/ and src/components/passport/geometry.json.

The PDF is CorelDRAW output with all text converted to outlines, so nothing can
be "edited" in it. Instead every page is rendered, the sample student's data
(Aanya's name, photo, levels, stars, remarks) is erased, and the per-student
pieces (level badges, stars, puzzle pieces in each level colour) are cut out as
separate images. ResultPassport.tsx lays real data back on top.

All coordinates are PDF points (page = 372.33 x 528.24 pt), the same unit the
component positions its overlays in.
"""
import glob
import json
import os
import re
import subprocess
import sys
import tempfile

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

K = 4          # render scale, px per pt (288 dpi)
BG_SCALE = 3   # px per pt for the page backgrounds shipped to the browser
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public', 'passport')
GEOMETRY = os.path.join(ROOT, 'src', 'components', 'passport', 'geometry.json')

CREAM = np.array([247, 235, 209], float)


def px(v):
    return int(round(v * K))


def sl(r):
    x0, y0, x1, y1 = r
    return slice(px(y0), px(y1)), slice(px(x0), px(x1))


def mode_color(a, r):
    ys, xs = sl(r)
    sub = a[ys, xs].reshape(-1, 3).astype(np.int32)
    keys = sub[:, 0] << 16 | sub[:, 1] << 8 | sub[:, 2]
    vals, counts = np.unique(keys, return_counts=True)
    k = vals[counts.argmax()]
    return np.array([k >> 16 & 255, k >> 8 & 255, k & 255], float)


def fill(a, r, color=None):
    a[sl(r)] = mode_color(a, r) if color is None else color


def inpaint(a, mask, dilate=2):
    """Fills masked pixels from their surroundings (multi-scale normalized
    convolution) — good for removing text from smooth gradients."""
    m = ndimage.binary_dilation(mask, iterations=dilate) if dilate else mask
    ys, xs = np.where(m)
    if not len(ys):
        return
    pad = 160
    y0, y1 = max(ys.min() - pad, 0), min(ys.max() + pad, a.shape[0])
    x0, x1 = max(xs.min() - pad, 0), min(xs.max() + pad, a.shape[1])
    sub, mm = a[y0:y1, x0:x1], m[y0:y1, x0:x1]
    known = (~mm).astype(float)
    todo = mm.copy()
    for s in (2, 4, 8, 16, 32, 64, 128, 256):
        den = ndimage.gaussian_filter(known, s)
        ok = todo & (den > (0.2 if s < 256 else 1e-4))
        if ok.any():
            for c in range(3):
                num = ndimage.gaussian_filter(sub[..., c] * known, s)
                sub[..., c][ok] = (num / np.maximum(den, 1e-6))[ok]
            todo &= ~ok
        if not todo.any():
            break
    a[y0:y1, x0:x1] = sub


def luminance(a):
    return a[..., 0] * 0.299 + a[..., 1] * 0.587 + a[..., 2] * 0.114


def region_mask(shape, r):
    m = np.zeros(shape[:2], bool)
    m[sl(r)] = True
    return m


def disc_mask(shape, cx, cy, rad):
    yy, xx = np.mgrid[0:shape[0], 0:shape[1]]
    return (xx + 0.5 - cx * K) ** 2 + (yy + 0.5 - cy * K) ** 2 <= (rad * K) ** 2


def color_to_alpha(rgb, bg):
    """Smallest alpha such that rgb = alpha*colour + (1-alpha)*bg (GIMP's
    colour-to-alpha). Turns art drawn on a flat tint into a clean cut-out."""
    d = rgb - bg
    up = np.where(d > 0, d / np.maximum(255 - bg, 1e-6), 0)
    down = np.where(d < 0, -d / np.maximum(bg, 1e-6), 0)
    alpha = np.maximum(up, down).max(-1).clip(0, 1)
    col = bg + d / np.maximum(alpha[..., None], 1e-6)
    return np.dstack([col.clip(0, 255), alpha * 255])


def save_rgba(rgba, name):
    img = Image.fromarray(rgba.round().clip(0, 255).astype(np.uint8), 'RGBA')
    img.save(os.path.join(OUT, name), 'WEBP', quality=92, alpha_quality=100, method=6)


def save_bg(a, name):
    img = Image.fromarray(a.round().clip(0, 255).astype(np.uint8), 'RGB')
    w, h = img.size
    img = img.resize((round(w * BG_SCALE / K), round(h * BG_SCALE / K)), Image.LANCZOS)
    img.save(os.path.join(OUT, name), 'WEBP', quality=88, method=6)


def crop(a, r):
    return a[sl(r)].copy()


def erase_page_number(a):
    """Removes the digits inside the page-number circle (the number shifts
    when a student has more or fewer written-round pages) but keeps the
    circle: ink blobs that touch the probe box's edge are the ring."""
    r = (178, 490.5, 194, 508.5)
    ys, xs = sl(r)
    bg = mode_color(a, r)
    ink = np.abs(a[ys, xs] - bg).sum(-1) > 60
    lab, n = ndimage.label(ink)
    digits = np.zeros_like(ink)
    for i, (sy, sx) in enumerate(ndimage.find_objects(lab), 1):
        if sy.start > 0 and sx.start > 0 and sy.stop < ink.shape[0] and sx.stop < ink.shape[1]:
            digits |= lab == i
    sub = a[ys, xs]
    sub[ndimage.binary_dilation(digits, iterations=2) & ~(ink & ~digits)] = bg


def clear_crop_marks(a):
    h, w = a.shape[0] / K, a.shape[1] / K
    for r in ((0, 0, 12, 12), (w - 12, 0, w, 12), (0, h - 12, 12, h), (w - 12, h - 12, w, h)):
        # the marks sit in the bleed; paint them with the colour just inside
        x0, y0, x1, y1 = r
        probe = (x0 + 12, y0 + 12, x1 + 12, y1 + 12) if x0 == 0 and y0 == 0 else \
                (x0 - 12, y0 + 12, x1 - 12, y1 + 12) if y0 == 0 else \
                (x0 + 12, y0 - 12, x1 + 12, y1 - 12) if x0 == 0 else (x0 - 12, y0 - 12, x1 - 12, y1 - 12)
        fill(a, r, mode_color(a, probe))


# ── SVG path → antialiased mask (for the puzzle pieces) ──────────────────────

def flatten_path(d):
    toks = re.findall(r'[MLCZmlcz]|-?\d*\.?\d+(?:e-?\d+)?', d)
    polys, cur, i, cmd, pos = [], [], 0, None, (0.0, 0.0)
    while i < len(toks):
        t = toks[i]
        if t in 'MLCZmlcz':
            cmd = t
            i += 1
            if cmd in 'Zz':
                if cur:
                    polys.append(cur)
                cur = []
            continue
        if cmd == 'M':
            if cur:
                polys.append(cur)
            pos = (float(toks[i]), float(toks[i + 1]))
            cur = [pos]
            i += 2
            cmd = 'L'
        elif cmd == 'L':
            pos = (float(toks[i]), float(toks[i + 1]))
            cur.append(pos)
            i += 2
        elif cmd == 'C':
            p1 = (float(toks[i]), float(toks[i + 1]))
            p2 = (float(toks[i + 2]), float(toks[i + 3]))
            p3 = (float(toks[i + 4]), float(toks[i + 5]))
            for s in np.linspace(0, 1, 17)[1:]:
                u = 1 - s
                cur.append((u**3 * pos[0] + 3 * u * u * s * p1[0] + 3 * u * s * s * p2[0] + s**3 * p3[0],
                            u**3 * pos[1] + 3 * u * u * s * p1[1] + 3 * u * s * s * p2[1] + s**3 * p3[1]))
            pos = p3
            i += 6
        else:
            raise ValueError(f'unsupported path command {cmd}')
    if cur:
        polys.append(cur)
    return polys


def path_mask(shape, d, ss=4):
    img = Image.new('L', (shape[1] * ss, shape[0] * ss), 0)
    dr = ImageDraw.Draw(img)
    for poly in flatten_path(d):
        dr.polygon([(x * K * ss, y * K * ss) for x, y in poly], fill=255)
    img = img.resize((shape[1], shape[0]), Image.BOX)
    return np.asarray(img, float) / 255


# ── Page processing ──────────────────────────────────────────────────────────

def main(pdf):
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(os.path.dirname(GEOMETRY), exist_ok=True)
    tmp = tempfile.mkdtemp(prefix='passport-')
    subprocess.run(['pdftoppm', '-r', str(72 * K), '-png', pdf, os.path.join(tmp, 'p')], check=True)
    pages = [np.asarray(Image.open(f).convert('RGB'), float) for f in sorted(glob.glob(os.path.join(tmp, 'p-*.png')))]
    assert len(pages) == 12, f'expected 12 pages, got {len(pages)}'
    for a in pages:
        clear_crop_marks(a)
    for n in (4, 6, 7, 8, 9, 10, 11):
        erase_page_number(pages[n - 1])
    geo = {'page': {'w': 372.3307, 'h': 528.2362}}

    # Static pages ship as-is.
    for n in (1, 10, 11, 12):
        save_bg(pages[n - 1], f'p{n:02d}.webp')

    # p2 — ID card: photo and the seven values.
    a = pages[1]
    fill(a, (31, 139, 137, 273.5), CREAM)
    for r in ((196, 155.5, 340, 167.5), (196, 194.5, 340, 206), (196, 232, 340, 246.5),
              (196, 272.5, 340, 286.5), (196, 314.5, 340, 326.5), (196, 353.5, 340, 366.5),
              (196, 393.5, 340, 406.5)):
        fill(a, r, CREAM)
    save_bg(a, 'p02.webp')

    # p3 — welcome letter: "Dear Aanya,"
    a = pages[2]
    fill(a, (44, 150, 112, 165.5), CREAM)
    save_bg(a, 'p03.webp')

    # p4 — written round template (p5 is the same design with PART 2).
    a = pages[3]
    lines = [100.25, 138.25, 176.5, 214.5, 252.5, 290.75, 328.75, 367.0, 405.0, 443.0, 481.25]
    geo['written'] = {'rowLines': lines, 'tableLeft': 37.75, 'divider': 213.25, 'tableRight': 334.75,
                      'lineColor': '#D7B56D'}
    badge_rows = {'progressing': 0, 'not-attempted': 1, 'proficient': 3, 'beginner': 6}
    for name, k in badge_rows.items():
        y0, y1 = lines[k] + 0.75, lines[k + 1]
        save_rgba(np.dstack([crop(a, (213.75, y0, 334.25, y1)), np.full((px(y1) - px(y0), px(334.25) - px(213.75)), 255.0)]),
                  f'badge-{name}.webp')
    geo['badgeCell'] = {'x': 213.75, 'w': 334.25 - 213.75}
    fill(a, (163.5, 65, 209, 78.75), CREAM)           # "PART 1"
    for k in range(10):
        y0, y1 = lines[k] + 0.75, lines[k + 1]
        fill(a, (38.5, y0, 213.25, y1), CREAM)
        fill(a, (213.75, y0, 334.25, y1), CREAM)
    save_bg(a, 'p04.webp')

    # p6 — talent round: video names, five level cells, remarks.
    a = pages[5]
    fill(a, (52, 82, 170, 135), CREAM)
    t_lines = [176.75, 214.75, 253.0, 291.0, 329.25, 367.25]
    geo['talent'] = {'rowLines': t_lines}
    for k in range(5):
        fill(a, (213.75, t_lines[k] + 0.75, 334.25, t_lines[k + 1]), CREAM)
    rem = region_mask(a.shape, (45, 385, 330, 470)) & (luminance(a) < 170)
    inpaint(a, rem, dilate=3)
    save_bg(a, 'p06.webp')

    # p7 — panchakosha profile: stars + round level badge per kosha.
    a = pages[6]
    tops = [80.25, 159.0, 238.0, 316.75, 395.75]
    star_x = [63.75, 95.0, 126.25, 157.25, 188.5]
    geo['profile'] = {'rowTops': tops, 'starX': star_x, 'starDy': 46.75, 'starSize': [18.5, 18]}
    cards = [mode_color(a, (40, t + 40, 60, t + 70)) for t in tops]
    # stars (sample row 2 has full / half / empty)
    t = tops[1]
    for name, x in (('full', star_x[0]), ('half', star_x[2]), ('empty', star_x[3])):
        r = (x - 0.5, t + 46.5, x + 18, t + 64.5)
        save_rgba(color_to_alpha(crop(a, r), cards[1]), f'star-{name}.webp')
    # round badges: fit each circle to the outer edge of its outline (left,
    # right and top edges only — the bottom carries a soft shadow)
    badge_geo = []
    for i, t in enumerate(tops):
        r = (274.5, t + 1, 346, t + 74)
        ys, xs = sl(r)
        ink = np.abs(a[ys, xs] - cards[i]).sum(-1) > 80
        pts = []
        for y in range(ink.shape[0]):
            xx = np.nonzero(ink[y])[0]
            if len(xx):
                pts += [(xx[0], y), (xx[-1] + 1, y)]
        for x in range(ink.shape[1]):
            yy = np.nonzero(ink[:, x])[0]
            if len(yy):
                pts.append((x, yy[0]))
        P = np.array(pts, float) / K + [r[0], r[1]]
        A = np.c_[2 * P, np.ones(len(P))]
        cx, cy, c0 = np.linalg.lstsq(A, (P ** 2).sum(1), rcond=None)[0]
        badge_geo.append((cx, cy, np.sqrt(c0 + cx * cx + cy * cy)))
    rad = max(g[2] for g in badge_geo) + 0.5
    geo['profile']['badge'] = {'cx': [g[0] for g in badge_geo], 'cy': [g[1] for g in badge_geo], 'r': rad}
    for name, i in (('proficient', 0), ('beginner', 1), ('progressing', 2)):
        cx, cy = badge_geo[i][0], badge_geo[i][1]
        r = (cx - rad, cy - rad, cx + rad, cy + rad)
        rgba = color_to_alpha(crop(a, r), cards[i])
        h, w = rgba.shape[:2]
        yy, xx = np.mgrid[0:h, 0:w]
        outside = (xx + 0.5 - w / 2) ** 2 + (yy + 0.5 - h / 2) ** 2 > (rad * K) ** 2
        rgba[..., 3][outside] = 0
        save_rgba(rgba, f'round-{name}.webp')
    for i, t in enumerate(tops):
        fill(a, (star_x[0] - 1, t + 46, star_x[4] + 19, t + 65), cards[i])
        cx, cy = badge_geo[i][0], badge_geo[i][1]
        m = disc_mask(a.shape, cx, cy, rad) & (np.abs(a - cards[i]).sum(-1) > 6)
        a[m] = cards[i]
    save_bg(a, 'p07.webp')

    # p8 — panchakosha summary.
    a = pages[7]
    orig = a.copy()
    # Puzzle pieces: their outlines come straight from the vector art.
    svg = os.path.join(tmp, 'p8.svg')
    subprocess.run(['pdftocairo', '-svg', '-f', '8', '-l', '8', pdf, svg], check=True)
    src = open(svg, encoding='utf-8').read()
    fam = {  # base fill, text/icon colour
        'green': (np.array([121, 188, 101], float), np.array([7, 102, 52], float)),
        'blue': (np.array([16, 144, 207], float), np.array([39, 57, 110], float)),
        'orange': (np.array([247, 170, 71], float), np.array([179, 69, 31], float)),
    }
    fill_pat = {
        'green': r'47\.450256%, 73\.725891%, 39\.607239%',
        'blue': r'6\.274414%, 56\.471252%, 81\.176758%',
        'orange': r'96\.862793%, 66\.667175%, 27\.842712%',
    }
    pieces = []
    for f, pat in fill_pat.items():
        for mt in re.finditer(r'<path fill-rule="nonzero" fill="rgb\(' + pat + r'\)" fill-opacity="1" d="([^"]+)"', src):
            m = path_mask(a.shape, mt.group(1))
            yy, xx = np.nonzero(m > 0.5)
            pieces.append({'family': f, 'mask': m, 'cx': xx.mean() / K, 'cy': yy.mean() / K, 'at': mt.start()})
    assert len(pieces) == 5, f'expected 5 puzzle pieces, found {len(pieces)}'
    # Paint order matters: each piece (with its 3.6pt cream outline) covers
    # the tabs of the ones drawn before it. Keep only what's actually visible.
    pieces.sort(key=lambda p: p['at'])
    cover = np.zeros(a.shape[:2])
    for p in reversed(pieces):
        full = p['mask']
        p['mask'] = full * (1 - cover)
        grown = ndimage.grey_dilation(full, footprint=disc_mask((15, 15), 15 / 2 / K, 15 / 2 / K, 1.8))
        cover = np.maximum(cover, grown)
    # Centre of the wheel = centre of the cream disc ("GROWTH CHART OF …").
    wcx = np.mean([p['cx'] for p in pieces])
    wcy = np.mean([p['cy'] for p in pieces])
    order = {'ANNAMAYA': -90, 'PRANAMAYA': -18, 'MANOMAYA': 54, 'VIJNANAMAYA': 126, 'ANANDAMAYA': 198}
    for p in pieces:
        ang = np.degrees(np.arctan2(p['cy'] - wcy, p['cx'] - wcx))
        p['kosh'] = min(order, key=lambda k: min(abs(ang - order[k]) % 360, 360 - abs(ang - order[k]) % 360))
    assert len({p['kosh'] for p in pieces}) == 5, 'could not tell the puzzle pieces apart'

    # The smiley on Anandamaya is a photo-style emoji, kept as its own layer.
    W = np.array([255.0, 255.0, 255.0])
    geo['puzzle'] = {}
    for z, p in enumerate(pieces):
        B, T = fam[p['family']]
        m = p['mask']
        inside = m > 0.02
        yy, xx = np.nonzero(inside)
        y0, y1, x0, x1 = yy.min(), yy.max() + 1, xx.min(), xx.max() + 1
        sub = orig[y0:y1, x0:x1]
        msub = m[y0:y1, x0:x1]
        core = msub > 0.99
        # piece pixel = base blended toward white by the glow amount `g`
        wb = W - B
        g = ((sub - B) * wb).sum(-1) / (wb * wb).sum()
        fit = B + g[..., None].clip(0, 1) * wb
        resid = np.abs(sub - fit).sum(-1)
        ink = core & (resid > 18)
        emoji = np.zeros_like(ink)
        if p['kosh'] == 'ANANDAMAYA':
            yel = core & (sub[..., 0] > 200) & (sub[..., 1] > 150) & (sub[..., 2] < 120)
            ey, ex = np.nonzero(yel)
            pad = int(1.5 * K)
            emoji[max(ey.min() - pad, 0):ey.max() + pad, max(ex.min() - pad, 0):ex.max() + pad] = True
        unknown = ndimage.binary_dilation(ink | emoji, iterations=2) | ~core
        gfield = np.dstack([g.clip(0, 1)] * 3)
        inpaint(gfield, unknown & (msub > 0), dilate=0)
        gs = gfield[..., 0]
        G = B + gs[..., None] * wb
        tg = T - G
        k = ((sub - G) * tg).sum(-1) / np.maximum((tg * tg).sum(-1), 1e-6)
        k = np.where(ink & ~emoji, k.clip(0, 1), 0)
        for tf, (Bt, Tt) in fam.items():
            Gt = Bt + gs[..., None] * (W - Bt)
            rgb = (1 - k[..., None]) * Gt + k[..., None] * Tt
            save_rgba(np.dstack([rgb, msub * 255]), f'puzzle-{p["kosh"].lower()}-{tf}.webp')
        geo['puzzle'][p['kosh']] = {'x': x0 / K, 'y': y0 / K, 'w': (x1 - x0) / K, 'h': (y1 - y0) / K,
                                    'z': z}
        if emoji.any():
            ey, ex = np.nonzero(emoji)
            ys_, xs_ = slice(ey.min(), ey.max() + 1), slice(ex.min(), ex.max() + 1)
            esub = sub[ys_, xs_]
            # face silhouette against the local glow, filled, soft edge
            far = np.abs(esub - G[ys_, xs_]).sum(-1) > 45
            sil = ndimage.binary_fill_holes(ndimage.binary_opening(far, iterations=1))
            lab, _ = ndimage.label(sil)
            sizes = ndimage.sum(sil, lab, range(1, lab.max() + 1))
            sil = lab == (np.argmax(sizes) + 1)
            alpha = ndimage.gaussian_filter(sil.astype(float), 0.7)
            save_rgba(np.dstack([esub, alpha * 255]), 'puzzle-emoji.webp')
            geo['puzzle']['emoji'] = {'x': (x0 + ex.min()) / K, 'y': (y0 + ey.min()) / K,
                                      'w': (ex.max() + 1 - ex.min()) / K, 'h': (ey.max() + 1 - ey.min()) / K}
        # under the overlay, paint the piece in the outline cream so no
        # original colour fringes through antialiased edges
        grown = ndimage.binary_dilation(m > 0.02, iterations=3)
        a[grown & (np.abs(a - [249, 239, 217]).sum(-1) > 0)] = [249, 239, 217]

    # Centre disc, cut from the original with the sample name removed. Its
    # geometry comes from the circular clip path drawn around it.
    ccx = ccy = crad = None
    for m in re.finditer(r'<path[^>]*? d="([^"]+)"', src):
        nums = [float(v) for v in re.findall(r'-?\d*\.?\d+', m.group(1))]
        if len(nums) < 8:
            continue
        xs, ys = nums[0::2], nums[1::2]
        w, h = max(xs) - min(xs), max(ys) - min(ys)
        cx, cy = (max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2
        if 70 < w < 110 and abs(w - h) < 0.1 and np.hypot(cx - wcx, cy - wcy) < 15:
            ccx, ccy, crad = cx, cy, w / 2
            break
    assert crad, 'centre disc not found'
    R = crad + 0.4
    r = (ccx - R, ccy - R, ccx + R, ccy + R)
    sub = crop(orig, r)
    h, w = sub.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w]
    rr = np.hypot(xx + 0.5 - w / 2, yy + 0.5 - h / 2) / K
    ang = np.degrees(np.arctan2(yy + 0.5 - h / 2, xx + 0.5 - w / 2))
    text = np.abs(sub - [249, 239, 217]).sum(-1) > 45
    name_zone = (ang > 25) & (ang < 155) & (rr > crad * 0.45) & (rr < crad - 1)
    erase = ndimage.binary_dilation(text & name_zone, iterations=3) & name_zone
    # radial profile of the clean disc
    clean = ~ndimage.binary_dilation(text, iterations=3)
    bins = (rr * 8).astype(int)
    prof = np.zeros((bins.max() + 1, 3))
    for b in range(bins.max() + 1):
        sel = (bins == b) & clean
        prof[b] = np.median(sub[sel], axis=0) if sel.any() else [249, 239, 217]
    sub[erase] = prof[bins[erase]]
    # the rim carries a tint of whichever piece sat under it — neutralise it,
    # since the piece colours change per student
    rim = (rr > crad - 3) & ~ndimage.binary_dilation(text, iterations=1)
    sub[rim] = prof[int((crad - 3.2) * 8)]
    alpha = ((R - rr) * K).clip(0, 1) * 255
    save_rgba(np.dstack([sub, alpha]), 'p08-centre.webp')
    geo['centre'] = {'cx': ccx, 'cy': ccy, 'r': crad, 'box': R}

    # Overall level: "You are a Learner!" and the round badge.
    inpaint(a, region_mask(a.shape, (115, 464.6, 228, 482)) & (luminance(a) < 200), dilate=3)
    r = (245, 425, 320, 492)
    ys, xs = sl(r)
    blue = (a[ys, xs, 2] - a[ys, xs, 0]) > 50
    yy, xx = np.nonzero(blue)
    bcx = r[0] + (xx.min() + xx.max() + 1) / 2 / K
    bcy = r[1] + (yy.min() + yy.max() + 1) / 2 / K
    brad = (xx.max() - xx.min() + 1) / 2 / K
    inpaint(a, disc_mask(a.shape, bcx, bcy, brad + 2.5), dilate=0)
    geo['overall'] = {'badge': {'cx': bcx, 'cy': bcy, 'r': brad}}
    save_bg(a, 'p08.webp')

    # p9 — insights title.
    a = pages[8]
    fill(a, (118, 32.5, 254, 48.75))
    save_bg(a, 'p09.webp')

    with open(GEOMETRY, 'w') as f:
        json.dump(geo, f, indent=2, default=float)
    print('assets ->', OUT)
    print(json.dumps(geo, indent=2, default=float))


if __name__ == '__main__':
    main(sys.argv[1])
