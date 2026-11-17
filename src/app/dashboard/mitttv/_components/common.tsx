'use client';

import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Check, Film, Search, X } from 'lucide-react';
import { formatDuration } from '@/lib/mittTvShared';
import type { TvVideo } from '../_lib/api';

export function Thumb({ v, className = 'w-28' }: { v?: TvVideo | null; className?: string }) {
  return (
    <div className={`${className} aspect-video rounded-lg overflow-hidden bg-gray-900 shrink-0 relative border border-gray-100`}>
      {v?.previewThumbnailUrl
        ? <img src={v.previewThumbnailUrl} alt="" className="w-full h-full object-cover" />
        : <div className="w-full h-full flex items-center justify-center text-gray-500"><Film size={16} /></div>}
      {v && v.durationSec > 0 && (
        <span className="absolute bottom-1 right-1 text-[9px] font-bold text-white bg-black/70 rounded px-1">{formatDuration(v.durationSec)}</span>
      )}
    </div>
  );
}

export function Modal({ title, kicker, onClose, children, wide, busy }: {
  title: string; kicker?: string; onClose: () => void; children: React.ReactNode; wide?: boolean; busy?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
      <div className={`bg-white rounded-2xl shadow-2xl w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} my-8 overflow-hidden`}>
        <div className="bg-[#004f9f] px-5 py-4 flex items-center justify-between">
          <div>
            {kicker && <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">{kicker}</p>}
            <p className="text-white font-bold text-sm mt-0.5">{title}</p>
          </div>
          <button onClick={() => !busy && onClose()} disabled={busy} className="text-white/60 hover:text-white disabled:opacity-40"><X size={18} /></button>
        </div>
        <div className="p-5 max-h-[78vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

export function Switch({ on, onChange, disabled, label }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean; label?: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${on ? 'bg-[#009846]' : 'bg-gray-300'}`}>
      <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">{children}</label>;
}

export const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#004f9f]';

/** Ordered list of videos with move up / down / remove. */
export function OrderedVideos({ ids, videos, onChange, empty }: {
  ids: string[]; videos: Map<string, TvVideo>; onChange: (ids: string[]) => void; empty: string;
}) {
  const move = (i: number, d: number) => {
    const next = [...ids];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  if (ids.length === 0) return <p className="text-xs text-gray-400 py-6 text-center border border-dashed border-gray-200 rounded-xl">{empty}</p>;
  return (
    <div className="divide-y divide-gray-50 border border-gray-100 rounded-xl overflow-hidden">
      {ids.map((id, i) => {
        const v = videos.get(id);
        return (
          <div key={id} className="flex items-center gap-3 px-3 py-2 bg-white">
            <span className="text-xs text-gray-400 w-5 shrink-0 text-right">{i + 1}</span>
            <Thumb v={v} className="w-20" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-700 truncate font-medium">{v?.title ?? 'Deleted video'}</p>
              {v && !v.isActive && <p className="text-[10px] text-red-500 font-semibold">Hidden — not shown in the app</p>}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={() => move(i, -1)} disabled={i === 0} title="Move up"
                className="p-1.5 rounded-lg bg-gray-50 text-gray-500 hover:bg-gray-100 disabled:opacity-30"><ArrowUp size={13} /></button>
              <button onClick={() => move(i, 1)} disabled={i === ids.length - 1} title="Move down"
                className="p-1.5 rounded-lg bg-gray-50 text-gray-500 hover:bg-gray-100 disabled:opacity-30"><ArrowDown size={13} /></button>
              <button onClick={() => onChange(ids.filter((x) => x !== id))} title="Remove from this list"
                className="p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100"><X size={13} /></button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Pick videos from the library (search + tick). Returns the ticked ids in the order ticked. */
export function VideoPicker({ videos, selected, onDone, onClose, title }: {
  videos: TvVideo[]; selected: string[]; onDone: (ids: string[]) => void; onClose: () => void; title: string;
}) {
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<string[]>(selected);
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return videos.filter((v) => !s || v.title.toLowerCase().includes(s) || v.tags.toLowerCase().includes(s));
  }, [videos, q]);
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <Modal title={title} kicker="Choose videos" onClose={onClose} wide>
      <div className="relative mb-3">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search videos by title or tag"
          className={`${inputCls} pl-9`} />
      </div>
      {list.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-10">No videos found. Add videos in the Videos tab first.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {list.map((v) => {
            const n = picked.indexOf(v.id);
            return (
              <button key={v.id} onClick={() => toggle(v.id)}
                className={`text-left rounded-xl border-2 p-1.5 transition-colors ${n >= 0 ? 'border-[#004f9f] bg-[#004f9f]/5' : 'border-transparent hover:bg-gray-50'}`}>
                <div className="relative">
                  <Thumb v={v} className="w-full" />
                  {n >= 0 && (
                    <span className="absolute top-1.5 left-1.5 w-6 h-6 rounded-full bg-[#004f9f] text-white text-[11px] font-bold flex items-center justify-center">{n + 1}</span>
                  )}
                </div>
                <p className="text-xs font-medium text-gray-700 mt-1.5 line-clamp-2">{v.title}</p>
                {!v.isActive && <p className="text-[10px] text-red-500 font-semibold">Hidden</p>}
              </button>
            );
          })}
        </div>
      )}
      <div className="flex items-center gap-2 pt-4 mt-4 border-t border-gray-100">
        <p className="text-xs text-gray-500 flex-1">{picked.length} selected — the number is their order</p>
        <button onClick={onClose} className="px-4 py-2 border border-gray-200 text-gray-600 text-sm font-semibold rounded-lg hover:bg-gray-50">Cancel</button>
        <button onClick={() => onDone(picked)}
          className="px-4 py-2 bg-[#004f9f] text-white text-sm font-bold rounded-lg hover:bg-[#003d7a] inline-flex items-center gap-1.5"><Check size={14} /> Done</button>
      </div>
    </Modal>
  );
}
