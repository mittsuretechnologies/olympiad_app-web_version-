'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { flatten, paginate, rich, type BookLabels, type Item, type RowItem, type TableDef } from '@/components/handbook/HandbookBook';
import type { Handbook } from '@/lib/handbook/moderator-handbook';

/**
 * Turns the School Panel Guide into an A4 PDF in the language being read.
 *
 * The pages are laid out off-screen as HTML and photographed one by one
 * (html-to-image → jsPDF), the same way the student passport is exported.
 * Going through the browser's own text rendering is what keeps Hindi correct:
 * jsPDF's text engine can't join Devanagari letters and matras.
 *
 * Mounted only while exporting; calls onDone when the file is saved or fails.
 */

const PW = 595;  // A4 in points; laid out at 1pt = 1px
const PH = 842;
const MX = 50;
const TOP = 62;
const BOTTOM = 58;
const CW = PW - 2 * MX;
const CH = PH - TOP - BOTTOM;

const NAVY = '#0B1B33';
const BLUE = '#1559C7';
const TEXT = '#2A3446';
const MUTED = '#677285';

function Block({ it, section }: { it: Exclude<Item, RowItem>; section: string }) {
  if (it.t === 'chapter') {
    return (
      <div style={{ paddingBottom: 14 }}>
        {it.b.n !== undefined && (
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', color: BLUE, textTransform: 'uppercase' }}>{section} {it.b.n}</div>
        )}
        <div style={{ marginTop: 4, fontSize: 21, fontWeight: 700, lineHeight: 1.25, color: NAVY }}>{it.b.title}</div>
        {it.b.subtitle && <div style={{ marginTop: 3, fontSize: 12, color: MUTED }}>{it.b.subtitle}</div>}
        <div style={{ marginTop: 10, height: 3, width: 48, borderRadius: 2, background: BLUE }} />
      </div>
    );
  }
  if (it.t === 'heading') {
    return <div style={{ paddingTop: 6, paddingBottom: 5, fontSize: 13.5, fontWeight: 700, color: NAVY }}>{rich(it.text)}</div>;
  }
  if (it.t === 'template') {
    return (
      <div style={{ paddingBottom: 9 }}>
        <div style={{ border: '1px solid #C9D6EE', background: '#F3F7FD', borderRadius: 8, padding: '9px 12px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: BLUE, paddingBottom: 4 }}>{it.b.title}</div>
          {it.b.lines.map((l, i) => (
            <p key={i} style={{ margin: 0, padding: '2px 0', fontSize: 11.3, lineHeight: 1.55, color: TEXT }}>{rich(l)}</p>
          ))}
        </div>
      </div>
    );
  }
  const bullet = it.indent === 1;
  const style: CSSProperties = {
    margin: 0, paddingBottom: bullet ? 3 : 7, paddingLeft: it.indent === 2 ? 22 : bullet ? 15 : 0,
    position: 'relative', fontSize: 11.5, lineHeight: 1.6, color: TEXT, fontStyle: it.indent === 2 ? 'italic' : undefined,
  };
  return (
    <p style={style}>
      {bullet && <span style={{ position: 'absolute', left: 3, color: BLUE }}>•</span>}
      {rich(it.text)}
    </p>
  );
}

function Table({ def, rows }: { def: TableDef; rows: number[] }) {
  const cell: CSSProperties = { padding: '5px 7px', fontSize: 10.8, lineHeight: 1.45, verticalAlign: 'top', textAlign: 'left' };
  return (
    <div style={{ paddingBottom: 10 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        {def.cols && <colgroup>{def.cols.map((w, i) => <col key={i} style={{ width: w }} />)}</colgroup>}
        <thead>
          <tr>{def.head.map(h => <th key={h} style={{ ...cell, background: '#EEF3FC', color: NAVY, fontWeight: 700, borderBottom: `1.5px solid ${BLUE}` }}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r}>
              {def.rows[r].map((c, ci) => (
                <td key={ci} style={{ ...cell, color: TEXT, borderBottom: '1px solid #E6E8EC', fontWeight: ci === 0 ? 600 : undefined }}>{rich(c)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PageBody({ items, tables, section }: { items: Item[]; tables: TableDef[]; section: string }) {
  const out: ReactNode[] = [];
  for (let i = 0; i < items.length;) {
    const it = items[i];
    if (it.t === 'row') {
      const rows: number[] = [];
      while (i < items.length && items[i].t === 'row' && (items[i] as RowItem).table === it.table) {
        rows.push((items[i] as RowItem).row);
        i++;
      }
      out.push(<Table key={`t${it.key}`} def={tables[it.table]} rows={rows} />);
      continue;
    }
    out.push(<Block key={it.key} it={it} section={section} />);
    i++;
  }
  return <>{out}</>;
}

const sheetStyle: CSSProperties = { position: 'relative', width: PW, height: PH, overflow: 'hidden', background: '#ffffff' };

export default function GuidePdfExport({
  handbook, labels, fileName, onDone,
}: {
  handbook: Handbook;
  labels: BookLabels;
  fileName: string;
  onDone: () => void;
}) {
  const { items, tables } = useMemo(() => flatten(handbook.blocks), [handbook]);
  const measureRef = useRef<HTMLDivElement>(null);
  const sheetsRef = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<Item[][] | null>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  // 1) Once fonts are in, measure every block at the A4 text width and pack pages.
  useEffect(() => {
    let alive = true;
    document.fonts.ready.then(() => {
      const root = measureRef.current;
      if (!alive || !root) return;
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
      setPages(paginate(
        items,
        it => (it.t === 'row' ? rowH[it.table]?.[it.row] ?? 0 : h.get(it.key) ?? 0),
        id => extra[id] ?? 0,
        CH - 4,
      ));
    });
    return () => { alive = false; };
  }, [items]);

  // 2) Photograph each laid-out sheet into the PDF.
  useEffect(() => {
    if (!pages) return;
    let cancelled = false;
    (async () => {
      try {
        const [{ toJpeg, getFontEmbedCSS }, { jsPDF }] = await Promise.all([import('html-to-image'), import('jspdf')]);
        const root = sheetsRef.current;
        if (!root) return;
        const sheets = Array.from(root.children) as HTMLElement[];
        const fontEmbedCSS = await getFontEmbedCSS(sheets[0]).catch(() => undefined);
        const pdf = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait', compress: true });
        const w = pdf.internal.pageSize.getWidth();
        const hgt = pdf.internal.pageSize.getHeight();
        for (let i = 0; i < sheets.length; i++) {
          if (cancelled) return;
          const jpeg = await toJpeg(sheets[i], { pixelRatio: 2, quality: 0.88, fontEmbedCSS, width: PW, height: PH, backgroundColor: '#ffffff' });
          if (i > 0) pdf.addPage('a4', 'portrait');
          pdf.addImage(jpeg, 'JPEG', 0, 0, w, hgt, undefined, 'FAST');
        }
        pdf.save(fileName);
      } catch (err) {
        console.error('Guide PDF export failed:', err instanceof Event ? err.type : err);
        alert('Could not create the PDF. Please try again.');
      } finally {
        if (!cancelled) onDoneRef.current();
      }
    })();
    return () => { cancelled = true; };
  }, [pages, fileName]);

  // Contents: chapter → PDF page number (cover is 1, contents is 2).
  const toc = useMemo(() => {
    if (!pages) return [];
    const list: { key: number; n?: number; title: string; page: number }[] = [];
    pages.forEach((pg, i) => pg.forEach(it => { if (it.t === 'chapter') list.push({ key: it.key, n: it.b.n, title: it.b.title, page: i + 3 }); }));
    return list;
  }, [pages]);

  const total = pages ? pages.length + 2 : 0;
  const footer = (n: number) => (
    <div style={{ position: 'absolute', left: MX, right: MX, bottom: 24, display: 'flex', justifyContent: 'space-between', fontSize: 9, color: MUTED, borderTop: '1px solid #E6E8EC', paddingTop: 6 }}>
      <span>{labels.runningTitle} · mittmee</span>
      <span>{n} / {total}</span>
    </div>
  );

  return (
    <div aria-hidden style={{ position: 'fixed', left: -100000, top: 0, pointerEvents: 'none' }}>
      {/* Measuring column: same width and type as the pages. */}
      <div ref={measureRef} style={{ width: CW }}>
        {items.map(it => (it.t === 'row' ? null : <div key={it.key} data-k={it.key}><Block it={it} section={labels.section} /></div>))}
        {tables.map((tb, id) => <div key={`m${id}`} data-t={id}><Table def={tb} rows={tb.rows.map((_, i) => i)} /></div>)}
      </div>

      {pages && (
        <div ref={sheetsRef}>
          {/* Cover */}
          <div style={sheetStyle}>
            <div style={{ position: 'absolute', inset: 0, background: NAVY }} />
            <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 8, background: `linear-gradient(90deg, ${BLUE}, #3CB043)` }} />
            <div style={{ position: 'absolute', left: MX, right: MX, top: 250, color: '#ffffff' }}>
              <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.3em', color: '#9DB7E8' }}>MITTMEE</div>
              <div style={{ marginTop: 18, fontSize: 40, fontWeight: 700, lineHeight: 1.15 }}>{labels.coverTitle[0]}<br />{labels.coverTitle[1]}</div>
              <div style={{ marginTop: 18, height: 3, width: 64, borderRadius: 2, background: '#3CB043' }} />
              <div style={{ marginTop: 18, fontSize: 14, color: '#C9D6EE' }}>{handbook.title}</div>
            </div>
            <div style={{ position: 'absolute', left: MX, right: MX, bottom: 56, display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9DB7E8' }}>
              <span>{labels.version} {handbook.version}</span>
              <span>{labels.effectiveDate}: {handbook.effectiveDate}</span>
            </div>
          </div>

          {/* Contents */}
          <div style={sheetStyle}>
            <div style={{ position: 'absolute', left: MX, right: MX, top: TOP }}>
              <div style={{ fontSize: 21, fontWeight: 700, color: NAVY }}>{labels.contents}</div>
              <div style={{ marginTop: 10, marginBottom: 14, height: 3, width: 48, borderRadius: 2, background: BLUE }} />
              {toc.map(e => (
                <div key={e.key} style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '6px 0', borderBottom: '1px dotted #D2D7DF', fontSize: 12.5, color: TEXT }}>
                  <span style={{ width: 22, fontWeight: 700, color: BLUE }}>{e.n ?? ''}</span>
                  <span style={{ flex: 1 }}>{e.title}</span>
                  <span style={{ fontWeight: 600 }}>{e.page}</span>
                </div>
              ))}
            </div>
            {footer(2)}
          </div>

          {/* Content */}
          {pages.map((pg, i) => (
            <div key={i} style={sheetStyle}>
              <div style={{ position: 'absolute', left: MX, right: MX, top: 26, fontSize: 9, color: MUTED, textAlign: 'right' }}>{labels.runningTitle}</div>
              <div style={{ position: 'absolute', left: MX, top: TOP, width: CW }}>
                <PageBody items={pg} tables={tables} section={labels.section} />
              </div>
              {footer(i + 3)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
