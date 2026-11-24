'use client';

import { useState } from 'react';
import {
  AlertCircle, ArrowDown, ArrowUp, Flame, GalleryHorizontal, GraduationCap, History, ListVideo, Loader2, Pencil, Plus, Sparkles, Trash2,
} from 'lucide-react';
import {
  CREATABLE_KINDS, DAYS_RANGE, LIMIT_RANGE, MITTTV_LIMITS, MIXABLE_KINDS, ROW_DEFAULTS, ROW_KINDS, ROW_STYLES, SEE_ALL_KINDS,
  SEE_ALL_LAYOUTS, TOTAL_RANGE, mixModes,
  type BannerMode, type RowKind, type RowStyle, type SeeAllLayout,
} from '@/lib/mittTvShared';
import { api, type TvRow, type TvVideo } from '../_lib/api';
import { Label, Modal, OrderedVideos, Switch, VideoPicker, inputCls } from './common';

const KIND_ICON: Record<string, typeof Flame> = {
  BANNER: GalleryHorizontal, CONTINUE: History, CURATED: ListVideo, MOST_WATCHED: Flame, NEW: Sparkles, CLASSES: GraduationCap,
};
const kindInfo = (k: string) => ROW_KINDS.find((x) => x.key === k);
const styleLabel = (s: string) => ROW_STYLES.find((x) => x.key === s)?.label ?? s;
const hasSeeAll = (k: string) => (SEE_ALL_KINDS as string[]).includes(k);
const layoutLabel = (l?: string) => SEE_ALL_LAYOUTS.find((x) => x.key === l)?.label ?? SEE_ALL_LAYOUTS[0].label;
const isMixable = (k: string) => (MIXABLE_KINDS as string[]).includes(k);

// The rows of the MittTV screen under the banner, in order.
export default function RowsTab({ rows, videos, videoMap, onChanged }: {
  rows: TvRow[]; videos: TvVideo[]; videoMap: Map<string, TvVideo>; onChanged: () => void;
}) {
  const [editing, setEditing] = useState<TvRow | 'new' | null>(null);
  const [busy, setBusy] = useState(false);
  const banner = rows.find((r) => r.kind === 'BANNER');
  const list = rows.filter((r) => r.kind !== 'BANNER');

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try { await fn(); onChanged(); } catch (e: any) { alert(e.message); } finally { setBusy(false); }
  };
  const move = (i: number, d: number) => {
    const next = [...list];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    const order = [...(banner ? [banner.id] : []), ...next.map((r) => r.id)];
    run(() => api('/api/dashboard/mitttv/rows', 'PUT', { order }));
  };
  const mine = (r: TvRow) => r.videoIds.filter((id) => videoMap.get(id)?.isActive).length;
  // How an automatic row uses the admin's own videos, for the line under its title.
  const mixText = (r: TvRow) => {
    const n = mine(r);
    if (r.settings.mode === 'MANUAL') return ` · only your ${n} video${n === 1 ? '' : 's'}`;
    if (r.settings.mode === 'AUTO' || n === 0) return '';
    return ` · your ${n} first`;
  };
  const count = (r: TvRow) => {
    if (r.kind === 'CURATED') return `${mine(r)} videos`;
    if (r.kind === 'CONTINUE') {
      const total = r.settings.total ?? ROW_DEFAULTS.continueTotal;
      return `Different for each user · ${Math.min(r.settings.limit ?? ROW_DEFAULTS.rowLimit, total)} on screen · ${total} in all`;
    }
    if (r.kind === 'MOST_WATCHED') return `Top ${r.settings.limit ?? ROW_DEFAULTS.top10Limit} · last ${r.settings.days ?? 7} days${mixText(r)}`;
    if (r.kind === 'NEW') {
      const total = r.settings.total ?? ROW_DEFAULTS.newTotal;
      return `Newest ${Math.min(r.settings.limit ?? ROW_DEFAULTS.rowLimit, total)} on screen · ${total} in all${mixText(r)}`;
    }
    if (r.kind === 'CLASSES') return 'Class tiles from the ERP · set up in Class Content';
    return '';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">The app shows these rows in this order, under the banner. A row with no videos is hidden automatically.</p>
        <button onClick={() => setEditing('new')}
          className="inline-flex items-center gap-2 bg-[#004f9f] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#003d7a] shrink-0">
          <Plus size={15} /> Add Row
        </button>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden divide-y divide-gray-50">
        {banner && (
          <div className="flex items-center gap-4 px-5 py-3 bg-gray-50/70">
            <span className="w-14" />
            <div className="w-9 h-9 rounded-xl bg-[#004f9f]/10 text-[#004f9f] flex items-center justify-center"><GalleryHorizontal size={16} /></div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-700">Big banner <span className="text-gray-400 font-normal">· always on top</span></p>
              <p className="text-[11px] text-gray-400">Set it up in the Banner tab.</p>
            </div>
            <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${banner.isVisible ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>{banner.isVisible ? 'On' : 'Off'}</span>
          </div>
        )}
        {list.map((r, i) => {
          const Icon = KIND_ICON[r.kind] ?? ListVideo;
          const single = kindInfo(r.kind)?.single;
          return (
            <div key={r.id} className={`flex items-center gap-4 px-5 py-3 ${r.isVisible ? '' : 'opacity-60'}`}>
              <div className="flex flex-col gap-0.5 w-14 items-center">
                <div className="flex gap-1">
                  <button onClick={() => move(i, -1)} disabled={busy || i === 0} title="Move up" className="p-1 rounded bg-gray-50 text-gray-500 hover:bg-gray-100 disabled:opacity-30"><ArrowUp size={12} /></button>
                  <button onClick={() => move(i, 1)} disabled={busy || i === list.length - 1} title="Move down" className="p-1 rounded bg-gray-50 text-gray-500 hover:bg-gray-100 disabled:opacity-30"><ArrowDown size={12} /></button>
                </div>
              </div>
              <div className="w-9 h-9 rounded-xl bg-[#004f9f]/10 text-[#004f9f] flex items-center justify-center shrink-0"><Icon size={16} /></div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">{r.title}{r.subtitle && <span className="text-gray-400 font-normal"> · {r.subtitle}</span>}</p>
                <p className="text-[11px] text-gray-400">
                  {kindInfo(r.kind)?.label ?? r.kind}{r.kind !== 'CLASSES' && <> · {styleLabel(r.style)}</>} · {count(r)}
                  {hasSeeAll(r.kind) && <> · See all: {layoutLabel(r.settings.seeAllLayout)}</>}
                </p>
              </div>
              <Switch on={r.isVisible} disabled={busy} label="Show row"
                onChange={(v) => run(() => api(`/api/dashboard/mitttv/rows/${r.id}`, 'PATCH', { isVisible: v }))} />
              <button onClick={() => setEditing(r)} title="Edit" className="p-1.5 rounded-lg bg-[#004f9f]/5 text-[#004f9f] hover:bg-[#004f9f]/10"><Pencil size={13} /></button>
              <button disabled={single || busy} title={single ? 'This row can be hidden but not deleted' : 'Delete row'}
                onClick={() => confirm(`Delete the row "${r.title}"? Its videos stay in the library.`) && run(() => api(`/api/dashboard/mitttv/rows/${r.id}`, 'DELETE'))}
                className="p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 disabled:opacity-30 disabled:cursor-not-allowed"><Trash2 size={13} /></button>
            </div>
          );
        })}
      </div>

      {editing && (
        <RowEditor row={editing === 'new' ? null : editing} videos={videos} videoMap={videoMap}
          onClose={() => setEditing(null)} onSaved={() => { setEditing(null); onChanged(); }} />
      )}
    </div>
  );
}

function RowEditor({ row, videos, videoMap, onClose, onSaved }: {
  row: TvRow | null; videos: TvVideo[]; videoMap: Map<string, TvVideo>; onClose: () => void; onSaved: () => void;
}) {
  const [kind, setKind] = useState<RowKind>((row?.kind as RowKind) ?? 'CURATED');
  const [title, setTitle] = useState(row?.title ?? '');
  const [subtitle, setSubtitle] = useState(row?.subtitle ?? '');
  const [style, setStyle] = useState<RowStyle>((row?.style as RowStyle) ?? 'LANDSCAPE');
  const [limit, setLimit] = useState(row?.settings.limit ?? (kind === 'MOST_WATCHED' ? ROW_DEFAULTS.top10Limit : ROW_DEFAULTS.rowLimit));
  const [days, setDays] = useState(row?.settings.days ?? ROW_DEFAULTS.days);
  const [total, setTotal] = useState(row?.settings.total ?? (row?.kind === 'CONTINUE' ? ROW_DEFAULTS.continueTotal : ROW_DEFAULTS.newTotal));
  const [seeAllLayout, setSeeAllLayout] = useState<SeeAllLayout>(row?.settings.seeAllLayout ?? 'AUTO');
  const [ids, setIds] = useState<string[]>(row?.videoIds ?? []);
  // Top 10 / Newest: how the videos you choose mix with the automatic ones.
  const [mode, setMode] = useState<BannerMode>(row?.settings.mode ?? 'MIXED');
  const [picking, setPicking] = useState(false);
  const mixable = isMixable(kind);
  const takesVideos = kind === 'CURATED' || mixable;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const pickKind = (k: RowKind) => {
    setKind(k);
    if (k === 'MOST_WATCHED') { setStyle('TOP10'); setLimit(ROW_DEFAULTS.top10Limit); }
    else { if (style === 'TOP10') setStyle('LANDSCAPE'); setLimit(ROW_DEFAULTS.rowLimit); }
  };

  const save = async () => {
    if (!title.trim()) { setError('The row needs a title'); return; }
    setSaving(true); setError('');
    try {
      const settings = kind === 'MOST_WATCHED' ? { limit, days, mode }
        : kind === 'NEW' ? { limit, seeAllLayout, total, mode }
          : kind === 'CONTINUE' ? { limit, seeAllLayout, total }
          : { limit, seeAllLayout };
      if (row) {
        await api(`/api/dashboard/mitttv/rows/${row.id}`, 'PATCH', {
          title, subtitle, style, settings, ...(takesVideos ? { videoIds: ids } : {}),
        });
      } else {
        const created = await api<TvRow>('/api/dashboard/mitttv/rows', 'POST', { kind, title, subtitle, style, settings });
        if (takesVideos && ids.length) await api(`/api/dashboard/mitttv/rows/${created.id}`, 'PATCH', { videoIds: ids });
      }
      onSaved();
    } catch (e: any) { setError(e.message); } finally { setSaving(false); }
  };

  return (
    <Modal title={row ? `Edit “${row.title}”` : 'Add a row to MittTV'} kicker={row ? 'Edit row' : 'New row'} onClose={onClose} busy={saving} wide>
      <div className="space-y-4">
        {!row && (
          <div>
            <Label>What the row shows</Label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {CREATABLE_KINDS.map((k) => {
                const info = kindInfo(k)!;
                const Icon = KIND_ICON[k];
                return (
                  <button key={k} type="button" onClick={() => pickKind(k)}
                    className={`text-left rounded-xl border px-3 py-2.5 ${kind === k ? 'border-[#004f9f] bg-[#004f9f]/5' : 'border-gray-200 hover:bg-gray-50'}`}>
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-700"><Icon size={14} /> {info.label}</span>
                    <span className="block text-[11px] text-gray-400 mt-0.5">{info.hint}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label>Title *</Label>
            <input value={title} maxLength={MITTTV_LIMITS.rowTitle} onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Stories, Rhymes, Bedtime" className={inputCls} />
          </div>
          <div>
            <Label>Subtitle (optional)</Label>
            <input value={subtitle} maxLength={MITTTV_LIMITS.rowSubtitle} onChange={(e) => setSubtitle(e.target.value)}
              placeholder="A short line under the title" className={inputCls} />
          </div>
        </div>

        {kind === 'CLASSES' && (
          <p className="text-[11px] text-gray-500 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
            This row shows class tiles (PG, Nursery … Class 12) that open the ERP&apos;s books and chapters. Choose which classes, series and books show in the Class Content tab.
          </p>
        )}

        {kind !== 'CLASSES' && (
        <div>
          <Label>Card style</Label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {ROW_STYLES.filter((s) => s.key !== 'TOP10' || kind === 'MOST_WATCHED' || kind === 'CURATED').map((s) => (
              <button key={s.key} type="button" onClick={() => setStyle(s.key)}
                className={`rounded-xl border px-2 py-2.5 flex flex-col items-center gap-1.5 ${style === s.key ? 'border-[#004f9f] bg-[#004f9f]/5' : 'border-gray-200 hover:bg-gray-50'}`}>
                <StylePreview style={s.key} />
                <span className="text-[11px] font-semibold text-gray-600">{s.label}</span>
              </button>
            ))}
          </div>
        </div>
        )}

        {kind !== 'CLASSES' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{kind === 'MOST_WATCHED' ? 'How many videos' : 'Videos on the MittTV screen'}</Label>
              <input type="number" min={LIMIT_RANGE.min} max={LIMIT_RANGE.max} value={limit}
                onChange={(e) => setLimit(Math.max(LIMIT_RANGE.min, Math.min(LIMIT_RANGE.max, Number(e.target.value) || 1)))} className={inputCls} />
              {kind !== 'MOST_WATCHED' && (
                <p className="text-[10px] text-gray-400 mt-1">
                  The rest open with &quot;See all&quot;{kind === 'CONTINUE' && ' (it shows once a user has started more videos than this)'}.
                </p>
              )}
            </div>
            {kind === 'MOST_WATCHED' && (
              <div>
                <Label>Views from the last (days)</Label>
                <input type="number" min={DAYS_RANGE.min} max={DAYS_RANGE.max} value={days}
                  onChange={(e) => setDays(Math.max(DAYS_RANGE.min, Math.min(DAYS_RANGE.max, Number(e.target.value) || 1)))} className={inputCls} />
              </div>
            )}
            {(kind === 'NEW' || kind === 'CONTINUE') && (
              <div>
                <Label>Videos in total</Label>
                <input type="number" min={TOTAL_RANGE.min} max={TOTAL_RANGE.max} value={total}
                  onChange={(e) => setTotal(Math.max(TOTAL_RANGE.min, Math.min(TOTAL_RANGE.max, Number(e.target.value) || 1)))} className={inputCls} />
                <p className="text-[10px] text-gray-400 mt-1">
                  {kind === 'CONTINUE'
                    ? <>Each user&apos;s last this-many started videos are kept in the row and its &quot;See all&quot;</>
                    : <>Only this many videos are in the row and its &quot;See all&quot; (your own videos count too)</>}
                  {total < limit && <> — so the screen shows {total}, not {limit}</>}.
                </p>
              </div>
            )}
          </div>
        )}

        {hasSeeAll(kind) && (
          <div>
            <Label>&quot;See all&quot; screen layout</Label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {SEE_ALL_LAYOUTS.map((l) => (
                <button key={l.key} type="button" onClick={() => setSeeAllLayout(l.key)} title={l.hint}
                  className={`rounded-xl border px-2 py-2.5 flex flex-col items-center gap-1.5 ${seeAllLayout === l.key ? 'border-[#004f9f] bg-[#004f9f]/5' : 'border-gray-200 hover:bg-gray-50'}`}>
                  <LayoutPreview layout={l.key === 'AUTO' ? (style === 'POSTER' || style === 'TOP10' ? 'GRID3' : 'GRID2') : l.key} />
                  <span className="text-[11px] font-semibold text-gray-600 text-center leading-tight">{l.label}</span>
                </button>
              ))}
            </div>
            <p className="text-[10px] text-gray-400 mt-1">{SEE_ALL_LAYOUTS.find((l) => l.key === seeAllLayout)?.hint} Opens from &quot;See all&quot; when the row has more videos than it shows.</p>
          </div>
        )}

        {mixable && (
          <div>
            <Label>Your own videos in this row</Label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {mixModes(kind).map((m) => (
                <button key={m.key} type="button" onClick={() => setMode(m.key)}
                  className={`text-left rounded-xl border px-3 py-2.5 ${mode === m.key ? 'border-[#004f9f] bg-[#004f9f]/5' : 'border-gray-200 hover:bg-gray-50'}`}>
                  <span className="block text-sm font-semibold text-gray-700">{m.label}</span>
                  <span className="block text-[11px] text-gray-400 mt-0.5">{m.hint}</span>
                </button>
              ))}
            </div>
            {mode !== 'AUTO' && (
              <div className="mt-3">
                <div className="flex items-center justify-between mb-1.5">
                  <Label>Your videos ({ids.length}) — shown first, in this order</Label>
                  <button onClick={() => setPicking(true)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#004f9f] hover:underline"><Plus size={12} /> Choose videos</button>
                </div>
                <OrderedVideos ids={ids} videos={videoMap} onChange={setIds}
                  empty={mode === 'MANUAL' ? 'No videos chosen yet — the row stays hidden in the app until you add some.' : `None chosen — the row fills itself with the ${kind === 'NEW' ? 'newest' : 'most watched'} videos.`} />
              </div>
            )}
          </div>
        )}

        {kind === 'CURATED' && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <Label>Videos in this row ({ids.length})</Label>
              <button onClick={() => setPicking(true)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#004f9f] hover:underline"><Plus size={12} /> Choose videos</button>
            </div>
            <OrderedVideos ids={ids} videos={videoMap} onChange={setIds} empty="No videos yet — the row stays hidden in the app until you add some." />
          </div>
        )}

        {error && <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2"><AlertCircle size={13} /> {error}</div>}
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} disabled={saving} className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-sm font-semibold rounded-lg hover:bg-gray-50 disabled:opacity-50">Cancel</button>
          <button onClick={save} disabled={saving}
            className="flex-1 py-2.5 bg-[#004f9f] text-white text-sm font-bold rounded-lg hover:bg-[#003d7a] disabled:opacity-50 flex items-center justify-center gap-2">
            {saving && <Loader2 size={14} className="animate-spin" />} {row ? 'Save Row' : 'Add Row'}
          </button>
        </div>
      </div>

      {picking && (
        <VideoPicker title={`Videos for “${title || 'this row'}”`} videos={videos} selected={ids}
          onClose={() => setPicking(false)} onDone={(next) => { setIds(next); setPicking(false); }} />
      )}
    </Modal>
  );
}

function StylePreview({ style }: { style: string }) {
  const box = 'bg-gray-300 rounded-[3px]';
  if (style === 'POSTER') return <div className="flex gap-1 h-9 items-end">{[0, 1, 2, 3].map((i) => <div key={i} className={`${box} w-4 h-7`} />)}</div>;
  if (style === 'LARGE') return <div className="flex gap-1 h-9 items-end">{[0, 1].map((i) => <div key={i} className={`${box} w-11 h-8`} />)}</div>;
  if (style === 'TOP10') {
    return (
      <div className="flex gap-1.5 h-9 items-end">
        {[1, 2, 3].map((n) => (
          <div key={n} className="flex items-end"><span className="text-lg font-black text-gray-400 leading-none -mr-0.5">{n}</span><div className={`${box} w-3.5 h-7`} /></div>
        ))}
      </div>
    );
  }
  return <div className="flex gap-1 h-9 items-end">{[0, 1, 2].map((i) => <div key={i} className={`${box} w-8 h-5`} />)}</div>;
}

/** A small phone-screen sketch of a "See all" layout. */
function LayoutPreview({ layout }: { layout: string }) {
  const box = 'bg-gray-300 rounded-[2px]';
  let inner;
  if (layout === 'GRID3') {
    inner = <div className="grid grid-cols-3 gap-[3px]">{[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className={`${box} h-[13px]`} />)}</div>;
  } else if (layout === 'LIST') {
    inner = (
      <div className="flex flex-col gap-[4px]">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex gap-[3px] items-center">
            <div className={`${box} w-[14px] h-[8px] shrink-0`} />
            <div className="flex-1 space-y-[2px]"><div className="h-[2px] bg-gray-300 rounded" /><div className="h-[2px] w-2/3 bg-gray-200 rounded" /></div>
          </div>
        ))}
      </div>
    );
  } else if (layout === 'BIG') {
    inner = <div className="flex flex-col gap-[3px]">{[0, 1].map((i) => <div key={i} className={`${box} h-[13px]`} />)}</div>;
  } else {
    inner = <div className="grid grid-cols-2 gap-[3px]">{[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className={`${box} h-[8px]`} />)}</div>;
  }
  return <div className="w-[34px] h-[44px] rounded-[5px] border border-gray-300 bg-white p-[3px] overflow-hidden">{inner}</div>;
}
