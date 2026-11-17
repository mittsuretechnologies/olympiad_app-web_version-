'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, GalleryHorizontal, Loader2, Pin, Save } from 'lucide-react';
import { BANNER_MODES, DAYS_RANGE, MITTTV_LIMITS, type BannerMode } from '@/lib/mittTvShared';
import { api, type TvRow, type TvVideo } from '../_lib/api';
import { Label, OrderedVideos, Switch, Thumb, VideoPicker, inputCls } from './common';

// The big sliding banner at the top of MittTV: most watched, pinned, or both.
export default function BannerTab({ row, videos, videoMap, onSaved }: {
  row: TvRow; videos: TvVideo[]; videoMap: Map<string, TvVideo>; onSaved: () => void;
}) {
  const [title, setTitle] = useState(row.title);
  const [mode, setMode] = useState<BannerMode>(row.settings.mode ?? 'MIXED');
  const [limit, setLimit] = useState(row.settings.limit ?? 6);
  const [days, setDays] = useState(row.settings.days ?? 7);
  const [pinned, setPinned] = useState<string[]>(row.videoIds);
  const [visible, setVisible] = useState(row.isVisible);
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setTitle(row.title); setMode(row.settings.mode ?? 'MIXED'); setLimit(row.settings.limit ?? 6);
    setDays(row.settings.days ?? 7); setPinned(row.videoIds); setVisible(row.isVisible);
  }, [row]);

  const dirty = title !== row.title || mode !== (row.settings.mode ?? 'MIXED') || limit !== (row.settings.limit ?? 6)
    || days !== (row.settings.days ?? 7) || visible !== row.isVisible || pinned.join() !== row.videoIds.join();

  const save = async () => {
    setSaving(true); setError('');
    try {
      await api(`/api/dashboard/mitttv/rows/${row.id}`, 'PATCH', {
        title, isVisible: visible, settings: { mode, limit, days }, videoIds: pinned,
      });
      onSaved();
    } catch (e: any) { setError(e.message); } finally { setSaving(false); }
  };

  const showingNow = (row.autoIds ?? []).map((id) => videoMap.get(id)).filter(Boolean) as TvVideo[];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-4">
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#004f9f]/10 text-[#004f9f] flex items-center justify-center"><GalleryHorizontal size={18} /></div>
          <div className="flex-1">
            <p className="text-sm font-bold text-gray-800">Big banner</p>
            <p className="text-xs text-gray-400">Always at the top of MittTV. Slides change by themselves; each has a Play button.</p>
          </div>
          <Switch on={visible} onChange={setVisible} label="Show banner" />
        </div>

        <div>
          <Label>Label on the banner</Label>
          <input value={title} maxLength={MITTTV_LIMITS.rowTitle} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
          <p className="text-[10px] text-gray-400 mt-1">A small tag on each slide, e.g. &quot;Most Watched&quot; or &quot;Featured&quot;.</p>
        </div>

        <div>
          <Label>What the banner shows</Label>
          <div className="space-y-2">
            {BANNER_MODES.map((m) => (
              <label key={m.key} className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 cursor-pointer ${mode === m.key ? 'border-[#004f9f] bg-[#004f9f]/5' : 'border-gray-200 hover:bg-gray-50'}`}>
                <input type="radio" checked={mode === m.key} onChange={() => setMode(m.key)} className="mt-1 accent-[#004f9f]" />
                <span>
                  <span className="block text-sm font-semibold text-gray-700">{m.label}</span>
                  <span className="block text-[11px] text-gray-400">{m.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Number of slides</Label>
            <input type="number" min={1} max={12} value={limit} onChange={(e) => setLimit(Math.max(1, Math.min(12, Number(e.target.value) || 1)))} className={inputCls} />
          </div>
          {mode !== 'MANUAL' && (
            <div>
              <Label>Most watched over (days)</Label>
              <input type="number" min={DAYS_RANGE.min} max={DAYS_RANGE.max} value={days}
                onChange={(e) => setDays(Math.max(DAYS_RANGE.min, Math.min(DAYS_RANGE.max, Number(e.target.value) || 1)))} className={inputCls} />
            </div>
          )}
        </div>

        {mode !== 'AUTO' && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <Label>Pinned videos ({pinned.length})</Label>
              <button onClick={() => setPicking(true)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#004f9f] hover:underline"><Pin size={12} /> Choose videos</button>
            </div>
            <OrderedVideos ids={pinned} videos={videoMap} onChange={setPinned}
              empty={mode === 'MANUAL' ? 'No pinned videos — the banner stays hidden until you pin some.' : 'No pinned videos — the most watched fill the banner.'} />
          </div>
        )}

        {error && <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2"><AlertCircle size={13} /> {error}</div>}
        <button onClick={save} disabled={!dirty || saving}
          className="w-full py-2.5 bg-[#004f9f] text-white text-sm font-bold rounded-lg hover:bg-[#003d7a] disabled:opacity-40 flex items-center justify-center gap-2">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save banner
        </button>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
        <p className="text-sm font-bold text-gray-800">Showing right now</p>
        <p className="text-xs text-gray-400 mb-3">The slides users see at this moment (most-watched counts refresh every few minutes). Save to update this list.</p>
        {!row.isVisible ? (
          <p className="text-xs text-gray-400 py-8 text-center">The banner is switched off.</p>
        ) : showingNow.length === 0 ? (
          <p className="text-xs text-gray-400 py-8 text-center">Nothing yet — add videos, or pin some.</p>
        ) : (
          <div className="space-y-2">
            {showingNow.map((v, i) => (
              <div key={v.id} className="flex items-center gap-3">
                <span className="text-xs text-gray-400 w-4">{i + 1}</span>
                <Thumb v={v} className="w-24" />
                <div className="min-w-0">
                  <p className="text-sm text-gray-700 truncate">{v.title}</p>
                  <p className="text-[10px] text-gray-400">{row.videoIds.includes(v.id) ? 'Pinned' : `${v.views7d} views this week`}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {picking && (
        <VideoPicker title="Pin videos to the banner" videos={videos} selected={pinned}
          onClose={() => setPicking(false)} onDone={(ids) => { setPinned(ids); setPicking(false); }} />
      )}
    </div>
  );
}
