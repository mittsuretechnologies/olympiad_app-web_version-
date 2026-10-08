'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import Image from 'next/image';
import { animate, motion, useMotionValue, useReducedMotion, useTransform, type MotionValue } from 'framer-motion';
import { ChevronLeft, ChevronRight, ListOrdered, ShieldCheck, X } from 'lucide-react';
import type { Handbook, HandbookBlock } from '@/lib/handbook/moderator-handbook';
import { literata } from './fonts';
import s from './HandbookBook.module.css';

/**
 * The Moderator Handbook as a hardcover book.
 *
 * Content is paginated by measurement: every block is rendered once off-screen
 * at the current page size, its height read back, and blocks are packed into
 * pages (tables split by row with the header repeated, headings kept with the
 * text that follows). That keeps real page breaks at any screen size.
 *
 * The book itself is modelled physically: page i and i+1 are the two faces of
 * one leaf, so a spread is (back of leaf t-1 | front of leaf t), covers are the
 * first and last leaves, and a page turn is that leaf rotating about the spine.
 * Wide screens show spreads; narrow screens show one page at a time.
 */

/* ── Content model ─────────────────────────────────────────────────────────── */

type Chapter = Extract<HandbookBlock, { k: 'chapter' }>;
type Template = Extract<HandbookBlock, { k: 'template' }>;
type TableDef = Extract<HandbookBlock, { k: 'table' }>;
type RowItem = { t: 'row'; key: number; table: number; row: number };
type Item =
  | { t: 'chapter'; key: number; b: Chapter }
  | { t: 'heading'; key: number; text: string }
  | { t: 'p'; key: number; text: string; indent: 0 | 1 | 2; drop: boolean }
  | RowItem
  | { t: 'template'; key: number; b: Template };

type BookPage =
  | { kind: 'cover' | 'backcover' | 'endpaper' | 'title' | 'contents' | 'blank' }
  | { kind: 'content'; items: Item[]; folio: number; running: string; opensChapter: boolean };

interface Geo {
  mode: 'spread' | 'single';
  pageW: number;
  pageH: number;
  fs: number;
  padTop: number;
  padBottom: number;
  padInner: number;
  padOuter: number;
  contentW: number;
  contentH: number;
}

const FRONT_MATTER = 4; // cover, endpaper, title, contents

function flatten(blocks: HandbookBlock[]) {
  const items: Item[] = [];
  const tables: TableDef[] = [];
  let key = 0;
  let afterChapter = false;
  for (const b of blocks) {
    if (b.k === 'chapter') { items.push({ t: 'chapter', key: key++, b }); afterChapter = true; continue; }
    if (b.k === 'heading') items.push({ t: 'heading', key: key++, text: b.text });
    if (b.k === 'p') {
      const indent = b.indent ?? 0;
      items.push({ t: 'p', key: key++, text: b.text, indent, drop: afterChapter && indent === 0 && /^[A-Za-z]/.test(b.text) });
    }
    if (b.k === 'table') {
      const id = tables.length;
      tables.push(b);
      b.rows.forEach((_, row) => items.push({ t: 'row', key: key++, table: id, row }));
    }
    if (b.k === 'template') items.push({ t: 'template', key: key++, b });
    afterChapter = false;
  }
  return { items, tables };
}

/** Headings, and lead-in lines ending in ":" stay on the page with what follows. */
const keepWithNext = (it: Item) =>
  it.t === 'chapter' || it.t === 'heading' || (it.t === 'p' && /:\s*(<\/b>)?$/.test(it.text));

function paginate(items: Item[], height: (it: Item) => number, tableExtra: (id: number) => number, max: number) {
  const pages: Item[][] = [];
  let cur: Item[] = [];
  let used = 0;
  const cost = (it: Item, onPage: Item[]) =>
    it.t === 'row' && !onPage.some(x => x.t === 'row' && x.table === it.table)
      ? height(it) + tableExtra(it.table)
      : height(it);

  for (const it of items) {
    if (it.t === 'chapter' && it.b.newPage && cur.length) { pages.push(cur); cur = []; used = 0; }
    let h = cost(it, cur);
    if (used + h > max && cur.length) {
      let n = cur.length;
      while (n > 0 && keepWithNext(cur[n - 1])) n--;
      const carry = n > 0 && n < cur.length ? cur.slice(n) : [];
      pages.push(carry.length ? cur.slice(0, n) : cur);
      cur = [];
      used = 0;
      for (const c of carry) { used += cost(c, cur); cur.push(c); }
      h = cost(it, cur);
    }
    cur.push(it);
    used += h;
  }
  if (cur.length) pages.push(cur);
  return pages;
}

function computeGeo(width: number, availH: number): Geo {
  const ratio = 1.34;
  const spread = width >= 760;
  let pageW = spread ? Math.min((width - 40) / 2, 640) : Math.min(width - 20, 580);
  let pageH = pageW * ratio;
  // The whole book and its controls must fit on screen without scrolling.
  const maxH = Math.max(360, availH);
  if (pageH > maxH) { pageH = maxH; pageW = pageH / ratio; }
  pageW = Math.floor(pageW);
  pageH = Math.floor(pageH);
  const padTop = Math.round(pageH * 0.085);
  const padBottom = Math.round(pageH * 0.085);
  const padOuter = Math.round(pageW * 0.1);
  const padInner = Math.round(pageW * 0.12);
  return {
    mode: spread ? 'spread' : 'single',
    pageW, pageH,
    fs: Math.max(11, Math.min(16, pageW / 33)),
    padTop, padBottom, padInner, padOuter,
    contentW: pageW - padInner - padOuter,
    contentH: pageH - padTop - padBottom,
  };
}

/* ── Inline markup: <b> <i> <mark> <a href> ────────────────────────────────── */

function rich(text: string): ReactNode {
  type Frame = { tag: string; href?: string; kids: ReactNode[] };
  const root: Frame = { tag: 'root', kids: [] };
  const stack: Frame[] = [root];
  const re = /<(\/?)(b|i|mark|a)(?:\s+href="([^"]*)")?>/g;
  let last = 0;
  let k = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) stack[stack.length - 1].kids.push(text.slice(last, m.index));
    last = m.index + m[0].length;
    if (!m[1]) { stack.push({ tag: m[2], href: m[3], kids: [] }); continue; }
    if (stack.length < 2) continue;
    const f = stack.pop()!;
    const el =
      f.tag === 'b' ? <b key={k++}>{f.kids}</b>
      : f.tag === 'i' ? <i key={k++}>{f.kids}</i>
      : f.tag === 'mark' ? <mark key={k++}>{f.kids}</mark>
      : <a key={k++} href={f.href} target="_blank" rel="noopener noreferrer">{f.kids}</a>;
    stack[stack.length - 1].kids.push(el);
  }
  if (last < text.length) stack[stack.length - 1].kids.push(text.slice(last));
  while (stack.length > 1) { const f = stack.pop()!; stack[stack.length - 1].kids.push(...f.kids); }
  return root.kids;
}

/* ── Blocks ────────────────────────────────────────────────────────────────── */

function ItemView({ it }: { it: Exclude<Item, RowItem> }) {
  if (it.t === 'chapter') {
    return (
      <div className={s.chapter}>
        {it.b.n !== undefined && <div className={s.chapterNum}>Section {it.b.n}</div>}
        <div className={s.chapterTitle}>{it.b.title}</div>
        {it.b.subtitle && <div className={s.chapterSub}>{it.b.subtitle}</div>}
        <div className={s.ornament} aria-hidden="true">◆</div>
      </div>
    );
  }
  if (it.t === 'heading') return <div className={s.heading}>{rich(it.text)}</div>;
  if (it.t === 'template') {
    return (
      <div className={s.template}>
        <div className={s.templateCard}>
          <div className={s.templateTitle}>{it.b.title}</div>
          {it.b.lines.map((l, i) => <p key={i} className={s.templateLine}>{rich(l)}</p>)}
        </div>
      </div>
    );
  }
  const indent = it.indent === 1 ? s.i1 : it.indent === 2 ? s.i2 : '';
  return <p className={`${s.p} ${indent} ${it.drop ? s.drop : ''}`}>{rich(it.text)}</p>;
}

function TableView({ def, rows }: { def: TableDef; rows: number[] }) {
  const tierCol = def.head.indexOf('Tier');
  return (
    <div className={s.tableWrap}>
      <table className={s.table}>
        {def.cols && <colgroup>{def.cols.map((w, i) => <col key={i} style={{ width: w }} />)}</colgroup>}
        <thead><tr>{def.head.map(h => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r}>
              {def.rows[r].map((c, ci) => (
                <td key={ci}>
                  {ci === tierCol && /^[1-4]$/.test(c)
                    ? <span className={`${s.tier} ${s[`tier${c}`]}`}>{c}</span>
                    : rich(c)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PageItems({ items, tables }: { items: Item[]; tables: TableDef[] }) {
  const out: ReactNode[] = [];
  for (let i = 0; i < items.length;) {
    const it = items[i];
    if (it.t === 'row') {
      const rows: number[] = [];
      while (i < items.length && items[i].t === 'row' && (items[i] as RowItem).table === it.table) {
        rows.push((items[i] as RowItem).row);
        i++;
      }
      out.push(<TableView key={`t${it.key}`} def={tables[it.table]} rows={rows} />);
      continue;
    }
    out.push(<ItemView key={it.key} it={it} />);
    i++;
  }
  return <>{out}</>;
}

/* ── The book ──────────────────────────────────────────────────────────────── */

export default function HandbookBook({ handbook }: { handbook: Handbook }) {
  const reduce = useReducedMotion();
  const stageRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [geo, setGeo] = useState<Geo | null>(null);
  const [fontTick, setFontTick] = useState(0);
  const [contentPages, setContentPages] = useState<Item[][] | null>(null);
  const [view, setView] = useState(0); // spread: leaves turned; single: page index
  const [flip, setFlip] = useState<{ from: number; to: number } | null>(null);
  const anchorRef = useRef<{ key: number | null; page: number }>({ key: null, page: 0 });

  const { items, tables } = useMemo(() => flatten(handbook.blocks), [handbook]);

  // Page size follows the stage width and the viewport height.
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const update = () => {
      const top = Math.max(el.getBoundingClientRect().top, 0);
      // Room taken by everything around the page: stage padding, the toolbar
      // and the dashboard card's bottom padding.
      const g = computeGeo(el.clientWidth - 24, window.innerHeight - top - 150);
      setGeo(prev => (prev && prev.pageW === g.pageW && prev.pageH === g.pageH && prev.mode === g.mode ? prev : g));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener('resize', update);
    return () => { ro.disconnect(); window.removeEventListener('resize', update); };
  }, []);

  // Re-measure once the book face has loaded (fallback metrics differ).
  useEffect(() => {
    const fonts = document.fonts;
    if (!fonts) return;
    let alive = true;
    const bump = () => { if (alive) setFontTick(t => t + 1); };
    fonts.ready.then(bump);
    fonts.addEventListener?.('loadingdone', bump);
    return () => { alive = false; fonts.removeEventListener?.('loadingdone', bump); };
  }, []);

  // Measure every block off-screen and pack into pages.
  useLayoutEffect(() => {
    const root = measureRef.current;
    if (!geo || !root) return;
    const h = new Map<number, number>();
    root.querySelectorAll<HTMLElement>('[data-k]').forEach(el => h.set(Number(el.dataset.k), el.getBoundingClientRect().height));
    const rowH: number[][] = [];
    const extra: number[] = [];
    root.querySelectorAll<HTMLElement>('[data-t]').forEach(el => {
      const id = Number(el.dataset.t);
      const rows = Array.from(el.querySelectorAll('tbody tr')).map(r => r.getBoundingClientRect().height);
      rowH[id] = rows;
      extra[id] = el.getBoundingClientRect().height - rows.reduce((a, b) => a + b, 0);
    });
    setContentPages(paginate(
      items,
      it => (it.t === 'row' ? rowH[it.table]?.[it.row] ?? 0 : h.get(it.key) ?? 0),
      id => extra[id] ?? 0,
      geo.contentH - 2,
    ));
  }, [geo, fontTick, items]);

  const book = useMemo(() => {
    if (!contentPages) return null;
    const pages: BookPage[] = [{ kind: 'cover' }, { kind: 'endpaper' }, { kind: 'title' }, { kind: 'contents' }];
    const toc: { key: number; n?: number; title: string; folio: number; page: number }[] = [];
    let running = '';
    contentPages.forEach((pageItems, i) => {
      const first = pageItems[0];
      const opensChapter = first?.t === 'chapter';
      const head = opensChapter ? first.b.title : running;
      for (const it of pageItems) {
        if (it.t !== 'chapter') continue;
        toc.push({ key: it.key, n: it.b.n, title: it.b.title, folio: i + 1, page: FRONT_MATTER + i });
        running = it.b.title;
      }
      pages.push({ kind: 'content', items: pageItems, folio: i + 1, running: head, opensChapter });
    });
    if (contentPages.length % 2 === 1) pages.push({ kind: 'blank' });
    pages.push({ kind: 'endpaper' }, { kind: 'backcover' });
    return { pages, toc, leaves: pages.length / 2, folios: contentPages.length };
  }, [contentPages]);

  const N = book?.pages.length ?? 0;
  const L = book?.leaves ?? 0;
  const spread = geo?.mode !== 'single';
  const last = spread ? L : N - 1;

  const viewForPage = useCallback((p: number) => (spread ? Math.ceil(p / 2) : p), [spread]);
  const pageOfItem = useCallback(
    (key: number) => book?.pages.findIndex(p => p.kind === 'content' && p.items.some(it => it.key === key)) ?? -1,
    [book],
  );

  // Keep the reader's place across re-pagination (resize, font load, mode switch).
  useEffect(() => {
    if (!book) return;
    const { key, page } = anchorRef.current;
    const p = key !== null ? pageOfItem(key) : Math.min(page, book.pages.length - 1);
    setFlip(null);
    setView(viewForPage(p < 0 ? 0 : p));
  }, [book, pageOfItem, viewForPage]);

  // Visible pages for the current view.
  const visible = useMemo(() => {
    if (spread) return [view > 0 ? 2 * view - 1 : null, view < L ? 2 * view : null];
    return [null, view];
  }, [spread, view, L]);

  // Remember where the reader is, as a content anchor rather than a page
  // number (page numbers move when the book is re-paginated). Updated only
  // when a turn settles, so a mid-resize render can't record a stale place.
  const remember = useCallback((v: number) => {
    if (!book) return;
    const vis = spread ? [v > 0 ? 2 * v - 1 : null, v < L ? 2 * v : null] : [v];
    const idx = vis.find(p => p !== null && book.pages[p]?.kind === 'content') ?? null;
    const page = idx !== null ? book.pages[idx] : null;
    const key = page && page.kind === 'content' ? page.items[0].key : null;
    anchorRef.current = { key, page: vis.find(p => p !== null) ?? 0 };
  }, [book, spread, L]);

  /* ── Turning ─────────────────────────────────────────────────────────────── */

  const rot = useMotionValue(0);
  const frontShade = useTransform(rot, [0, -90], [0, 0.42]);
  const backShade = useTransform(rot, [-90, -180], [0.42, 0]);
  const gloss = useTransform(rot, [0, -35, -90, -145, -180], [0, 0.5, 0, 0.3, 0]);
  const underRight = useTransform(rot, [0, -25, -100, -180], [0, 0.55, 0.15, 0]);
  const underLeft = useTransform(rot, [0, -80, -155, -180], [0, 0, 0.5, 0]);

  const commit = useCallback((to: number) => { setView(to); setFlip(null); remember(to); }, [remember]);

  const flipTo = useCallback((to: number) => {
    if (flip || !book) return;
    const target = Math.max(0, Math.min(last, to));
    if (target === view) return;
    if (reduce) { commit(target); return; }
    const dir = target > view ? 1 : -1;
    rot.set(dir === 1 ? 0 : -180);
    setFlip({ from: view, to: target });
    animate(rot, dir === 1 ? -180 : 0, {
      duration: 0.85,
      ease: [0.45, 0.05, 0.25, 1],
      onComplete: () => commit(target),
    });
  }, [flip, book, last, view, reduce, rot, commit]);

  const go = useCallback((dir: 1 | -1) => flipTo(view + dir), [flipTo, view]);

  // Drag a page by its outer edge; a plain click turns it.
  const drag = useRef<{ x0: number; dir: 1 | -1; active: boolean; id: number } | null>(null);
  const onDown = (dir: 1 | -1) => (e: React.PointerEvent<HTMLDivElement>) => {
    if (flip || e.button !== 0) return;
    drag.current = { x0: e.clientX, dir, active: false, id: e.pointerId };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId || !geo) return;
    const dx = (e.clientX - d.x0) * (d.dir === 1 ? -1 : 1);
    if (!d.active) {
      if (dx < 10 || reduce) return;
      d.active = true;
      rot.set(d.dir === 1 ? 0 : -180);
      setFlip({ from: view, to: view + d.dir });
    }
    const p = Math.max(0, Math.min(1, dx / (geo.pageW * 1.3)));
    rot.set(d.dir === 1 ? -180 * p : -180 + 180 * p);
  };
  const onUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.id !== e.pointerId) return;
    if (!d.active) { go(d.dir); return; }
    const p = d.dir === 1 ? -rot.get() / 180 : (rot.get() + 180) / 180;
    const to = view + d.dir;
    if (p > 0.28) {
      animate(rot, d.dir === 1 ? -180 : 0, { duration: 0.2 + 0.45 * (1 - p), ease: 'easeOut', onComplete: () => commit(to) });
    } else {
      animate(rot, d.dir === 1 ? 0 : -180, { duration: 0.3, ease: 'easeOut', onComplete: () => setFlip(null) });
    }
  };

  // Keyboard: ← → PageUp PageDown Home End
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); go(1); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(-1); }
      else if (e.key === 'Home') { e.preventDefault(); flipTo(0); }
      else if (e.key === 'End') { e.preventDefault(); flipTo(last); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, flipTo, last]);

  /* ── Rendering ───────────────────────────────────────────────────────────── */

  const measure = geo && (
    <div
      ref={measureRef}
      aria-hidden="true"
      className={`${s.body} ${literata.className}`}
      style={{ position: 'absolute', left: -10000, top: 0, width: geo.contentW, fontSize: geo.fs, visibility: 'hidden', pointerEvents: 'none' }}
    >
      {items.map(it => (it.t === 'row' ? null : <div key={it.key} data-k={it.key}><ItemView it={it} /></div>))}
      {tables.map((tb, id) => <div key={`m${id}`} data-t={id}><TableView def={tb} rows={tb.rows.map((_, i) => i)} /></div>)}
    </div>
  );

  if (!geo || !book) {
    return <div ref={stageRef} className={`${s.stage} ${literata.className}`} style={{ minHeight: 420 }}>{measure}</div>;
  }

  const { pageW, pageH } = geo;

  // What sits where: static pages, plus the turning leaf (front, back).
  let left: number | null;
  let right: number | null;
  let leaf: { front: number; back: number | null } | null = null;
  if (spread) {
    if (!flip) {
      [left, right] = [view > 0 ? 2 * view - 1 : null, view < L ? 2 * view : null];
    } else if (flip.to > flip.from) {
      left = flip.from > 0 ? 2 * flip.from - 1 : null;
      right = flip.to < L ? 2 * flip.to : null;
      leaf = { front: 2 * flip.from, back: 2 * flip.to - 1 };
    } else {
      left = flip.to > 0 ? 2 * flip.to - 1 : null;
      right = flip.from < L ? 2 * flip.from : null;
      leaf = { front: 2 * flip.to, back: 2 * flip.from - 1 };
    }
  } else {
    left = null;
    right = flip ? (flip.to > flip.from ? flip.to : flip.from) : view;
    if (flip) leaf = { front: flip.to > flip.from ? flip.from : flip.to, back: null };
  }

  const settled = flip ? flip.to : view;
  const closedFront = spread && settled === 0;
  const closedBack = spread && settled === L;
  const shiftX = closedFront ? -pageW / 2 : closedBack ? pageW / 2 : 0;
  const bookW = spread ? pageW * 2 : pageW;
  const rightX = spread ? pageW : 0;

  // Boards under the page block, and the page-edge thickness on each side.
  const isPaper = (p: number | null) => p !== null && p >= 2 && p <= N - 3;
  const leftLeaves = spread && left !== null && left >= 3 ? (left - 1) / 2 : 0;
  const rightLeaves = right !== null && isPaper(right) ? Math.floor((N - 2 - right) / 2) : 0;
  const thick = (n: number) => (n > 0 ? Math.min(9, Math.max(2, Math.round(n / 2.2))) : 0);
  const thL = thick(leftLeaves);
  const thR = thick(rightLeaves);
  const ribbonOn = spread && !closedFront && !closedBack && !flip;

  const pageStyle = (x: number): CSSProperties => ({ left: x, width: pageW, height: pageH, fontSize: geo.fs });

  const renderPage = (idx: number, side: 'left' | 'right', x: number | null, under?: MotionValue<number>) => {
    const page = book.pages[idx];
    const pos = x === null ? { left: 0, width: pageW, height: pageH, fontSize: geo.fs } : pageStyle(x);
    const sideCls = side === 'left' ? s.left : s.right;
    const shade = under && (
      <motion.div
        className={s.shade}
        style={{
          opacity: under,
          background: side === 'right'
            ? 'linear-gradient(to right, rgba(40,28,10,.55), rgba(40,28,10,.12) 35%, rgba(40,28,10,0) 70%)'
            : 'linear-gradient(to left, rgba(40,28,10,.55), rgba(40,28,10,.12) 35%, rgba(40,28,10,0) 70%)',
        }}
      />
    );

    if (page.kind === 'cover' || page.kind === 'backcover') {
      const front = page.kind === 'cover';
      return (
        <div key={`p${idx}`} className={`${s.page} ${sideCls}`} style={pos} aria-label={front ? 'Front cover' : 'Back cover'}>
          <div className={`${s.skin} ${s.leather} ${s.coverFront} ${s.hinge} ${front && closedFront && !flip ? s.closed : ''}`}>
            <div className={s.goldFrame} />
            {front ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center" style={{ padding: '0 16% 0 19%' }}>
                <span className={`${s.gold} text-[0.78em] tracking-[0.42em] font-semibold`}>MITTMEE</span>
                <span className="mt-[1.6em] flex items-center justify-center w-[4.2em] h-[4.2em] rounded-full border border-[#d4b26a]/70 shadow-[inset_0_0_0_3px_rgba(0,0,0,.15),0_1px_0_rgba(0,0,0,.4)]">
                  <ShieldCheck className="text-[#d6b66f] drop-shadow-[0_1px_0_rgba(0,0,0,.6)]" style={{ width: '2em', height: '2em' }} strokeWidth={1.4} />
                </span>
                <h2 className={`${s.gold} mt-[1.2em] text-[2.35em] leading-[1.08] font-semibold`}>Moderator<br />Handbook</h2>
                <span className="mt-[1.1em] h-px w-[5em] bg-[#d4b26a]/70" />
                <span className={`${s.gold} mt-[1em] text-[0.72em] tracking-[0.34em] font-semibold`}>INTERNAL</span>
                <span className={`${s.gold} absolute bottom-[12%] text-[0.7em] tracking-[0.2em]`}>VERSION {handbook.version}</span>
              </div>
            ) : (
              <div className="absolute inset-x-0 bottom-[12%] flex flex-col items-center">
                <ShieldCheck className="text-[#d6b66f]/80" style={{ width: '1.6em', height: '1.6em' }} strokeWidth={1.4} />
                <span className={`${s.gold} mt-[0.5em] text-[0.72em] tracking-[0.42em] font-semibold`}>MITTMEE</span>
              </div>
            )}
          </div>
          {shade}
        </div>
      );
    }

    if (page.kind === 'endpaper') {
      return (
        <div key={`p${idx}`} className={`${s.page} ${sideCls}`} style={pos} aria-hidden="true">
          <div className={`${s.skin} ${s.leather} ${s.hinge}`}><div className={`${s.pastedown} ${s.endpaper}`} /></div>
          {shade}
        </div>
      );
    }

    const pad = side === 'left'
      ? { left: geo.padOuter, right: geo.padInner }
      : { left: geo.padInner, right: geo.padOuter };
    const body = (children: ReactNode, extra?: CSSProperties) => (
      <div className={s.body} style={{ position: 'absolute', top: geo.padTop, bottom: geo.padBottom, ...pad, ...extra }}>{children}</div>
    );

    let inner: ReactNode = null;
    if (page.kind === 'title') {
      inner = body(
        <div className="h-full flex flex-col items-center text-center">
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className={s.ornament} aria-hidden="true">◆</div>
            <h1 className="mt-[1.2em] text-[1.55em] leading-[1.25] font-semibold text-[#1c2a44]">{handbook.title}</h1>
            <p className="mt-[1.1em] font-semibold">Version: {handbook.version}</p>
            <p className="mt-[0.4em]"><b>Effective date</b>: {handbook.effectiveDate}</p>
            <div className={`${s.ornament} mt-[1.4em]`} aria-hidden="true">◆</div>
          </div>
          <div className="flex items-center gap-[0.5em] opacity-80">
            <Image src="/mittmee-icon.jpeg" alt="" width={22} height={22} className="rounded-[4px]" />
            <span className="font-sans text-[0.9em] font-bold tracking-tight"><span className="text-[#1559C7]">mitt</span><span className="text-[#3CB043]">mee</span></span>
          </div>
        </div>,
      );
    } else if (page.kind === 'contents') {
      inner = body(
        <>
          <div className={s.tocTitle}>Contents</div>
          <div className={s.ornament} style={{ justifyContent: 'center' }} aria-hidden="true">◆</div>
          <div className={s.tocList}>
            {book.toc.map(e => (
              <button type="button" key={e.key} className={s.tocItem} onClick={() => flipTo(viewForPage(e.page))}>
                <span className={s.tocNum}>{e.n ?? ''}</span>
                <span className={s.tocText}>{e.title}</span>
                <span className={s.tocDots} />
                <span className={s.tocPage}>{e.folio}</span>
              </button>
            ))}
          </div>
        </>,
      );
    } else if (page.kind === 'content') {
      inner = (
        <>
          {!page.opensChapter && (
            <div className={s.runhead} style={{ top: geo.padTop * 0.42, ...pad, textAlign: side === 'left' ? 'left' : 'right' }}>
              {side === 'left' ? 'Moderator Handbook' : page.running}
            </div>
          )}
          {body(<PageItems items={page.items} tables={tables} />)}
          <div className={s.folio} style={{ bottom: geo.padBottom * 0.38, [side === 'left' ? 'left' : 'right']: geo.padOuter }}>{page.folio}</div>
        </>
      );
    }

    return (
      <div key={`p${idx}`} className={`${s.page} ${s.paperPage} ${s.paper} ${sideCls}`} style={pos} aria-label={page.kind === 'content' ? `Page ${page.folio}` : undefined}>
        {inner}
        {shade}
      </div>
    );
  };

  // Hot zones on the outer edge of each page: click to turn, drag to peel.
  const zone = (dir: 1 | -1) => {
    if (flip) return null;
    const can = dir === 1 ? view < last : view > 0;
    if (!can) return null;
    const pageIdx = dir === 1 ? right : left;
    const page = pageIdx !== null ? book.pages[pageIdx] : null;
    const full = page?.kind === 'cover' || page?.kind === 'backcover';
    const frac = full ? 1 : page?.kind === 'contents' ? 0.12 : 0.3;
    const w = pageW * frac;
    const x = dir === 1 ? rightX + pageW - w : 0;
    const showCorner = !full && page?.kind !== 'endpaper';
    return (
      <div
        className={s.hot}
        style={{ left: x, width: w }}
        onPointerDown={onDown(dir)}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        role="button"
        aria-label={dir === 1 ? 'Next page' : 'Previous page'}
        tabIndex={-1}
      >
        {showCorner && <span className={`${s.corner} ${dir === 1 ? s.cornerR : s.cornerL}`} />}
      </div>
    );
  };

  // Toolbar label
  const nameOf = (p: number | null) => {
    if (p === null) return null;
    const pg = book.pages[p];
    if (pg.kind === 'content') return pg.folio;
    return ({ cover: 'Cover', backcover: 'Back cover', title: 'Title page', contents: 'Contents' } as Record<string, string>)[pg.kind] ?? null;
  };
  const shown = (spread ? visible : [visible[1]]).map(nameOf).filter(v => v !== null) as (string | number)[];
  const nums = shown.filter((v): v is number => typeof v === 'number');
  const label = nums.length
    ? `${nums.length > 1 ? 'Pages' : 'Page'} ${nums.join('–')} of ${book.folios}`
    : shown.join(' · ');

  const btn = 'inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-[13px] font-medium text-[#3b3225] bg-white/70 border border-[#d7ccb6] hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors';

  return (
    <div ref={stageRef} className={s.stage}>
      <div className={`${s.scene} ${literata.className}`} style={{ height: pageH + 22, paddingTop: 6 }}>
        <div className={s.book} style={{ width: bookW, height: pageH, transform: `translateX(${spread ? shiftX : 0}px)` }}>
          <div className={s.shadow} style={spread ? { left: closedFront ? '52%' : '3%', right: closedBack ? '52%' : '3%' } : undefined} />

          {thL > 0 && <div className={`${s.board} ${s.leather}`} style={{ left: -8 - thL, width: pageW + 8 + thL }} />}
          {thR > 0 && <div className={`${s.board} ${s.leather}`} style={{ left: rightX, width: pageW + 8 + thR }} />}

          {ribbonOn && <div className={s.ribbon} style={{ left: pageW + 12, top: 8, height: pageH + 30, zIndex: 1 }} />}

          {thL > 0 && (
            <>
              <div className={s.stack} style={{ left: -thL, width: thL, top: 3, bottom: 3, zIndex: 2, borderRadius: '3px 0 0 3px' }} />
              <div className={s.stackBottom} style={{ left: -thL + 2, width: pageW + thL - 4, top: pageH, height: Math.ceil(thL / 2), zIndex: 2 }} />
            </>
          )}
          {thR > 0 && (
            <>
              <div className={s.stack} style={{ left: rightX + pageW, width: thR, top: 3, bottom: 3, zIndex: 2, borderRadius: '0 3px 3px 0' }} />
              <div className={s.stackBottom} style={{ left: rightX + 2, width: pageW + thR - 4, top: pageH, height: Math.ceil(thR / 2), zIndex: 2 }} />
            </>
          )}

          <div style={{ position: 'absolute', inset: 0, zIndex: 3 }}>
            {left !== null && renderPage(left, 'left', 0, flip ? underLeft : undefined)}
            {right !== null && renderPage(right, 'right', rightX, flip ? underRight : undefined)}
            {zone(-1)}
            {zone(1)}
          </div>

          {leaf && (
            <motion.div
              className={s.leaf}
              style={{ left: rightX, width: pageW, height: pageH, rotateY: rot, transformOrigin: '0% 50%' }}
            >
              <div className={s.face}>
                {renderPage(leaf.front, 'right', null)}
                <motion.div className={s.shade} style={{ opacity: frontShade, background: 'linear-gradient(to left, rgba(35,24,8,.55), rgba(35,24,8,.15))' }} />
                <motion.div className={s.shade} style={{ opacity: gloss, background: 'linear-gradient(to right, rgba(255,255,255,0) 15%, rgba(255,255,255,.55) 50%, rgba(255,255,255,0) 85%)', mixBlendMode: 'soft-light' }} />
              </div>
              <div className={`${s.face} ${s.faceBack}`}>
                {leaf.back !== null
                  ? renderPage(leaf.back, 'left', null)
                  : <div className={`${s.page} ${s.paperPage} ${s.paper} ${s.left}`} style={{ left: 0, width: pageW, height: pageH }} />}
                <motion.div className={s.shade} style={{ opacity: backShade, background: 'linear-gradient(to right, rgba(35,24,8,.55), rgba(35,24,8,.15))' }} />
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Controls: page navigation sits dead centre, under the spine (or the
          cover when closed); Contents to its left, Close + hint to its right.
          Equal 1fr side columns keep the centre fixed as buttons come and go. */}
      <div className="relative z-10 mt-3 flex flex-wrap items-center justify-center gap-2 font-sans sm:grid sm:grid-cols-[1fr_auto_1fr]">
        <div className="flex justify-end">
          <button type="button" className={btn} onClick={() => flipTo(viewForPage(3))} disabled={!!flip}>
            <ListOrdered size={15} /> Contents
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className={`${btn} justify-center sm:w-[108px]`} onClick={() => go(-1)} disabled={view === 0 || !!flip} aria-label="Previous page">
            <ChevronLeft size={16} /> <span className="hidden sm:inline">Previous</span>
          </button>
          <span className="min-w-[150px] text-center text-[12.5px] font-medium text-[#5b4f3c] tabular-nums" aria-live="polite">{label}</span>
          <button type="button" className={`${btn} justify-center sm:w-[108px]`} onClick={() => go(1)} disabled={view === last || !!flip} aria-label="Next page">
            <span className="hidden sm:inline">Next</span> <ChevronRight size={16} />
          </button>
        </div>
        <div className="flex items-center gap-3 min-w-0">
          {view !== 0 && (
            <button type="button" className={btn} onClick={() => flipTo(0)} disabled={!!flip}>
              <X size={15} /> Close book
            </button>
          )}
          <span className="hidden xl:inline truncate text-[11.5px] text-[#8a7c62]">Click or drag a page edge to turn · ← → keys</span>
        </div>
      </div>

      {measure}
    </div>
  );
}
