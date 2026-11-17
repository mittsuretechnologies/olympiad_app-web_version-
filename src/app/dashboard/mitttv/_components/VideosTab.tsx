'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle, CalendarDays, Eye, EyeOff, Film, ImageIcon, LayoutGrid, List as ListIcon, Loader2, Pencil, Plus,
  Search, Star, Tag, Trash2, TrendingUp, Trophy, UploadCloud, X,
} from 'lucide-react';
import { MITTTV_LIMITS, PICKED_KINDS, formatDuration, type VideoDetail } from '@/lib/mittTvShared';
import { api, inspectVideo, uploadImage, uploadVideo, type TvRow, type TvVideo } from '../_lib/api';
import { Label, Modal, Switch, inputCls } from './common';

type Filter = 'ALL' | 'ACTIVE' | 'HIDDEN';
type Sort = 'NEW' | 'VIEWS' | 'WEEK' | 'TITLE';
type Layout = 'GRID' | 'LIST';

const SORTS: { key: Sort; label: string }[] = [
  { key: 'NEW', label: 'Newest first' },
  { key: 'VIEWS', label: 'Most views' },
  { key: 'WEEK', label: 'Most views this week' },
  { key: 'TITLE', label: 'Title A–Z' },
];
const SORT_FN: Record<Sort, (a: TvVideo, b: TvVideo) => number> = {
  NEW: (a, b) => b.createdAt.localeCompare(a.createdAt),
  VIEWS: (a, b) => b.viewsCount - a.viewsCount || b.createdAt.localeCompare(a.createdAt),
  WEEK: (a, b) => b.views7d - a.views7d || b.viewsCount - a.viewsCount,
  TITLE: (a, b) => a.title.localeCompare(b.title),
};
const LAYOUT_KEY = 'mitttv:videosLayout';

const viewsText = (n: number) => `${n} view${n === 1 ? '' : 's'}`;
const dateText = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};
const tagList = (tags: string) => tags.split(',').map((t) => t.trim()).filter(Boolean);

export default function VideosTab({ videos, rows, onSaved, onDeleted }: {
  videos: TvVideo[]; rows: TvRow[]; onSaved: (v: TvVideo) => void; onDeleted: (id: string) => void;
}) {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('ALL');
  const [sort, setSort] = useState<Sort>('NEW');
  const [layout, setLayout] = useState<Layout>('GRID');
  const [editing, setEditing] = useState<TvVideo | 'new' | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Grid / list is remembered in this browser.
  useEffect(() => {
    try { if (localStorage.getItem(LAYOUT_KEY) === 'LIST') setLayout('LIST'); } catch { /* private mode */ }
  }, []);
  const pickLayout = (l: Layout) => {
    setLayout(l);
    try { localStorage.setItem(LAYOUT_KEY, l); } catch { /* private mode */ }
  };

  const bannerId = useMemo(() => rows.find((r) => r.kind === 'BANNER')?.id ?? null, [rows]);
  const rowName = useMemo(() => new Map(rows.filter((r) => r.kind !== 'BANNER').map((r) => [r.id, r.title])), [rows]);

  const stats = useMemo(() => {
    const active = videos.filter((v) => v.isActive).length;
    const top = [...videos].filter((v) => v.views7d > 0).sort(SORT_FN.WEEK)[0] ?? null;
    return {
      active,
      hidden: videos.length - active,
      views: videos.reduce((n, v) => n + v.viewsCount, 0),
      week: videos.reduce((n, v) => n + v.views7d, 0),
      top,
    };
  }, [videos]);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return videos
      .filter((v) => (filter === 'ALL' || (filter === 'ACTIVE' ? v.isActive : !v.isActive))
        && (!s || v.title.toLowerCase().includes(s) || v.tags.toLowerCase().includes(s) || v.description.toLowerCase().includes(s)))
      .sort(SORT_FN[sort]);
  }, [videos, q, filter, sort]);

  const toggleActive = async (v: TvVideo) => {
    setBusyId(v.id);
    try { onSaved(await api<TvVideo>(`/api/dashboard/mitttv/videos/${v.id}`, 'PATCH', { isActive: !v.isActive })); }
    catch (e: any) { alert(e.message); }
    finally { setBusyId(null); }
  };
  const remove = async (v: TvVideo) => {
    if (!confirm(`Delete "${v.title}"? The video file, its place in every row and everyone's progress are deleted too. This cannot be undone.`)) return;
    try { await api(`/api/dashboard/mitttv/videos/${v.id}`, 'DELETE'); onDeleted(v.id); }
    catch (e: any) { alert(e.message); }
  };

  const cardProps = (v: TvVideo) => ({
    v,
    pinned: !!bannerId && v.rowIds.includes(bannerId),
    rowTitles: v.rowIds.flatMap((id) => (rowName.has(id) ? [rowName.get(id)!] : [])),
    busy: busyId === v.id,
    onEdit: () => setEditing(v),
    onToggle: () => toggleActive(v),
    onDelete: () => remove(v),
  });

  return (
    <div className="space-y-4">
      {/* At a glance */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat icon={Film} tone="blue" label="Videos" value={String(videos.length)} hint={`${stats.active} in app · ${stats.hidden} hidden`} />
        <Stat icon={Eye} tone="green" label="Total views" value={String(stats.views)} hint="One per user a day" />
        <Stat icon={TrendingUp} tone="violet" label="Views this week" value={String(stats.week)} hint="Last 7 days" />
        <Stat icon={Trophy} tone="amber" label="Top this week" value={stats.top?.title ?? '—'} hint={stats.top ? viewsText(stats.top.views7d) : 'No views yet'} />
      </div>

      {/* Toolbar */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-2.5 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title, description or tag"
            className="w-full bg-gray-50 border border-transparent rounded-xl pl-9 pr-8 py-2 text-sm focus:outline-none focus:bg-white focus:border-[#004f9f]" />
          {q && (
            <button onClick={() => setQ('')} title="Clear search" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={14} /></button>
          )}
        </div>
        <div className="flex rounded-xl bg-gray-100 p-0.5">
          {([['ALL', 'All', videos.length], ['ACTIVE', 'In app', stats.active], ['HIDDEN', 'Hidden', stats.hidden]] as [Filter, string, number][]).map(([f, label, n]) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-[10px] text-xs font-semibold inline-flex items-center gap-1.5 transition-colors ${filter === f ? 'bg-white text-[#004f9f] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {label} <span className={`text-[10px] px-1.5 rounded-full ${filter === f ? 'bg-[#004f9f]/10' : 'bg-gray-200/80'}`}>{n}</span>
            </button>
          ))}
        </div>
        <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} title="Sort"
          className="border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-600 bg-white focus:outline-none focus:border-[#004f9f]">
          {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        <div className="flex rounded-xl bg-gray-100 p-0.5">
          {([['GRID', LayoutGrid, 'Grid'], ['LIST', ListIcon, 'List']] as [Layout, typeof LayoutGrid, string][]).map(([l, Icon, label]) => (
            <button key={l} onClick={() => pickLayout(l)} title={`${label} view`}
              className={`p-1.5 rounded-[10px] ${layout === l ? 'bg-white text-[#004f9f] shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
              <Icon size={15} />
            </button>
          ))}
        </div>
        <button onClick={() => setEditing('new')}
          className="inline-flex items-center gap-2 bg-[#004f9f] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#003d7a]">
          <Plus size={15} /> Add Video
        </button>
      </div>

      {list.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl py-16 flex flex-col items-center gap-3 text-center px-6">
          <div className="w-14 h-14 rounded-2xl bg-[#004f9f]/5 text-[#004f9f] flex items-center justify-center"><Film size={24} /></div>
          {videos.length === 0 ? (
            <>
              <p className="text-sm font-semibold text-gray-700">No videos yet</p>
              <p className="text-xs text-gray-400 max-w-sm">Add the first one — it shows in MittTV straight away (in Newest, and in any row you put it in).</p>
              <button onClick={() => setEditing('new')} className="mt-1 inline-flex items-center gap-2 bg-[#004f9f] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#003d7a]"><Plus size={15} /> Add Video</button>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-gray-700">No videos match</p>
              <button onClick={() => { setQ(''); setFilter('ALL'); }} className="text-xs font-semibold text-[#004f9f] hover:underline">Clear search and filter</button>
            </>
          )}
        </div>
      ) : layout === 'GRID' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
          {list.map((v) => <VideoCard key={v.id} {...cardProps(v)} />)}
        </div>
      ) : (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          <div className={`hidden md:grid ${LIST_COLS} gap-4 px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-gray-400 bg-gray-50/80 border-b border-gray-100`}>
            <span>Video</span><span>Rows</span><span>Views</span><span>Added</span><span className="text-right">In app</span>
          </div>
          {list.map((v) => <VideoLine key={v.id} {...cardProps(v)} />)}
        </div>
      )}

      {editing && (
        <VideoForm
          video={editing === 'new' ? null : editing}
          rows={rows.filter((r) => (PICKED_KINDS as string[]).includes(r.kind))}
          onClose={() => setEditing(null)}
          onSaved={(v) => { onSaved(v); setEditing(null); }}
        />
      )}
    </div>
  );
}

const STAT_TONES = {
  blue: 'bg-[#004f9f]/10 text-[#004f9f]',
  green: 'bg-emerald-50 text-emerald-600',
  violet: 'bg-violet-50 text-violet-600',
  amber: 'bg-amber-50 text-amber-600',
} as const;

function Stat({ icon: Icon, tone, label, value, hint }: {
  icon: typeof Film; tone: keyof typeof STAT_TONES; label: string; value: string; hint: string;
}) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm px-4 py-3.5 flex items-center gap-3 min-w-0">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${STAT_TONES[tone]}`}><Icon size={18} /></div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{label}</p>
        <p className="text-lg font-bold text-gray-800 truncate leading-snug" title={value}>{value}</p>
        <p className="text-[11px] text-gray-400 truncate">{hint}</p>
      </div>
    </div>
  );
}

type CardProps = {
  v: TvVideo; pinned: boolean; rowTitles: string[]; busy: boolean;
  onEdit: () => void; onToggle: () => void; onDelete: () => void;
};

/** The video's picture: dimmed when hidden, with its length and badges. */
function Picture({ v, pinned, small }: { v: TvVideo; pinned: boolean; small?: boolean }) {
  return (
    <>
      {v.previewThumbnailUrl
        ? <img src={v.previewThumbnailUrl} alt="" className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.04] ${v.isActive ? '' : 'grayscale opacity-60'}`} />
        : <div className="w-full h-full flex items-center justify-center text-gray-500"><Film size={small ? 16 : 24} /></div>}
      {!small && (
        <div className="absolute top-2 left-2 right-2 flex items-start justify-between gap-1 pointer-events-none">
          {!v.isActive
            ? <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-gray-900/85 text-white rounded-full px-2 py-0.5"><EyeOff size={10} /> Hidden</span>
            : <span />}
          {pinned && <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-400 text-amber-950 rounded-full px-2 py-0.5 shadow"><Star size={10} className="fill-current" /> Banner</span>}
        </div>
      )}
      {v.durationSec > 0 && (
        <span className={`absolute bottom-1.5 right-1.5 font-bold text-white bg-black/75 rounded-md ${small ? 'text-[9px] px-1' : 'text-[10px] px-1.5 py-0.5'}`}>{formatDuration(v.durationSec)}</span>
      )}
    </>
  );
}

function RowChips({ titles, max = 3 }: { titles: string[]; max?: number }) {
  if (!titles.length) return <span className="text-[11px] text-gray-300 italic">Not in a hand-picked row</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {titles.slice(0, max).map((t) => (
        <span key={t} className="px-2 py-0.5 text-[10px] font-semibold bg-[#004f9f]/5 text-[#004f9f] border border-[#004f9f]/15 rounded-full">{t}</span>
      ))}
      {titles.length > max && <span className="px-2 py-0.5 text-[10px] font-semibold bg-gray-100 text-gray-500 rounded-full">+{titles.length - max}</span>}
    </div>
  );
}

function VideoCard({ v, pinned, rowTitles, busy, onEdit, onToggle, onDelete }: CardProps) {
  const tags = tagList(v.tags);
  return (
    <div className="group bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden flex flex-col transition-all hover:shadow-md hover:-translate-y-0.5">
      <button type="button" onClick={onEdit} className="relative block w-full aspect-video bg-gray-900 overflow-hidden" title="Edit video">
        <Picture v={v} pinned={pinned} />
        <span className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors">
          <span className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1.5 bg-white/95 text-gray-800 text-xs font-bold px-3 py-1.5 rounded-full shadow">
            <Pencil size={12} /> Edit
          </span>
        </span>
      </button>
      <div className="p-3.5 flex-1 flex flex-col gap-2.5">
        <div className="min-w-0">
          <p className="text-sm font-bold text-gray-800 truncate" title={v.title}>{v.title}</p>
          <p className={`text-xs truncate mt-0.5 ${v.description ? 'text-gray-500' : 'text-gray-300 italic'}`}>{v.description || 'No description'}</p>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-500">
          <span className="inline-flex items-center gap-1"><Eye size={12} /> {viewsText(v.viewsCount)}</span>
          <span className={`inline-flex items-center gap-1 ${v.views7d > 0 ? 'text-emerald-600 font-semibold' : ''}`}><TrendingUp size={12} /> {v.views7d} this week</span>
          <span className="inline-flex items-center gap-1"><CalendarDays size={12} /> {dateText(v.createdAt)}</span>
        </div>
        <RowChips titles={rowTitles} />
        {tags.length > 0 && (
          <p className="text-[11px] text-gray-400 truncate inline-flex items-center gap-1"><Tag size={11} className="shrink-0" /> {tags.join(', ')}</p>
        )}
        <div className="flex items-center gap-2 mt-auto pt-2.5 border-t border-gray-100">
          <Switch on={v.isActive} disabled={busy} onChange={onToggle} label="Show in app" />
          <span className={`text-[11px] font-semibold flex-1 ${v.isActive ? 'text-green-700' : 'text-gray-400'}`}>{v.isActive ? 'Showing in app' : 'Hidden'}</span>
          <button onClick={onEdit} title="Edit" className="p-1.5 rounded-lg bg-[#004f9f]/5 text-[#004f9f] hover:bg-[#004f9f]/10"><Pencil size={13} /></button>
          <button onClick={onDelete} title="Delete" className="p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100"><Trash2 size={13} /></button>
        </div>
      </div>
    </div>
  );
}

const LIST_COLS = 'md:grid-cols-[minmax(0,1fr)_170px_110px_110px_150px]';

function VideoLine({ v, pinned, rowTitles, busy, onEdit, onToggle, onDelete }: CardProps) {
  return (
    <div className={`group grid grid-cols-1 ${LIST_COLS} gap-3 md:gap-4 items-center px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50/60`}>
      <button type="button" onClick={onEdit} className="flex items-center gap-3 min-w-0 text-left" title="Edit video">
        <div className="relative w-28 aspect-video rounded-lg overflow-hidden bg-gray-900 shrink-0">
          <Picture v={v} pinned={pinned} small />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-800 truncate">{v.title}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            {pinned && <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-600"><Star size={10} className="fill-current" /> Banner</span>}
            {!v.isActive && <span className="text-[10px] font-bold text-gray-400">Hidden</span>}
            <p className={`text-xs truncate ${v.description ? 'text-gray-400' : 'text-gray-300 italic'}`}>{v.description || 'No description'}</p>
          </div>
        </div>
      </button>
      <RowChips titles={rowTitles} max={2} />
      <div className="text-xs">
        <p className="text-gray-700 font-semibold">{viewsText(v.viewsCount)}</p>
        <p className={v.views7d > 0 ? 'text-emerald-600' : 'text-gray-400'}>{v.views7d} this week</p>
      </div>
      <p className="text-xs text-gray-500">{dateText(v.createdAt)}</p>
      <div className="flex items-center md:justify-end gap-2">
        <Switch on={v.isActive} disabled={busy} onChange={onToggle} label="Show in app" />
        <button onClick={onEdit} title="Edit" className="p-1.5 rounded-lg bg-[#004f9f]/5 text-[#004f9f] hover:bg-[#004f9f]/10"><Pencil size={13} /></button>
        <button onClick={onDelete} title="Delete" className="p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100"><Trash2 size={13} /></button>
      </div>
    </div>
  );
}

function VideoForm({ video, rows, onClose, onSaved }: {
  video: TvVideo | null; rows: TvRow[]; onClose: () => void; onSaved: (v: TvVideo) => void;
}) {
  const [title, setTitle] = useState(video?.title ?? '');
  const [description, setDescription] = useState(video?.description ?? '');
  const [tags, setTags] = useState(video?.tags ?? '');
  const [videoUrl, setVideoUrl] = useState(video?.videoUrl ?? '');
  const [thumbnailUrl, setThumbnailUrl] = useState(video?.thumbnailUrl ?? '');
  // A thumbnail uploaded by hand (or an edited video's existing one) is kept
  // when the video file is replaced; an automatic one is captured again.
  const thumbCustom = useRef(!!video?.thumbnailUrl);
  const [posterUrl, setPosterUrl] = useState(video?.posterUrl ?? '');
  const [durationSec, setDurationSec] = useState(video?.durationSec ?? 0);
  const [isActive, setIsActive] = useState(video?.isActive ?? true);
  const [rowIds, setRowIds] = useState<string[]>(video?.rowIds ?? []);
  const [details, setDetails] = useState<VideoDetail[]>(Array.isArray(video?.meta?.details) ? video!.meta.details! : []);
  const [notes, setNotes] = useState<string[]>(Array.isArray(video?.meta?.notes) ? video!.meta.notes! : []);

  const [videoPreview, setVideoPreview] = useState<string | null>(video?.previewVideoUrl ?? null);
  const [thumbPreview, setThumbPreview] = useState<string | null>(video?.previewThumbnailUrl ?? null);
  const [posterPreview, setPosterPreview] = useState<string | null>(video?.previewPosterUrl ?? null);
  const [videoProgress, setVideoProgress] = useState<number | null>(null);
  const [imageBusy, setImageBusy] = useState<'thumb' | 'poster' | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const videoRef = useRef<HTMLInputElement>(null);
  const thumbRef = useRef<HTMLInputElement>(null);
  const posterRef = useRef<HTMLInputElement>(null);
  const busy = videoProgress !== null || imageBusy !== null || saving;

  // Uploads the video and, alongside, reads its length and captures a
  // thumbnail (unless one was uploaded by hand already for a new video).
  const pickVideo = async (file: File) => {
    setError('');
    setVideoPreview(URL.createObjectURL(file));
    setVideoProgress(0);
    const keepThumb = thumbCustom.current;
    const inspect = inspectVideo(file).then(async ({ thumb, durationSec: d }) => {
      if (d) setDurationSec(d);
      if (thumb && !keepThumb) {
        setImageBusy('thumb');
        setThumbPreview(URL.createObjectURL(thumb));
        try { setThumbnailUrl(await uploadImage(thumb)); } catch { setThumbnailUrl(''); }
        setImageBusy(null);
      }
    });
    try {
      setVideoUrl(await uploadVideo(file, setVideoProgress));
    } catch (e: any) {
      setError(e.message);
      setVideoPreview(video?.previewVideoUrl ?? null);
      setVideoUrl(video?.videoUrl ?? '');
    } finally {
      setVideoProgress(null);
    }
    await inspect;
  };

  const pickImage = async (file: File, which: 'thumb' | 'poster') => {
    setError('');
    setImageBusy(which);
    const local = URL.createObjectURL(file);
    try {
      const url = await uploadImage(file);
      if (which === 'thumb') { setThumbnailUrl(url); setThumbPreview(local); thumbCustom.current = true; }
      else { setPosterUrl(url); setPosterPreview(local); }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setImageBusy(null);
    }
  };

  const save = async () => {
    if (!title.trim()) { setError('Title is required'); return; }
    if (!videoUrl) { setError('Upload a video'); return; }
    setSaving(true);
    setError('');
    try {
      const body = { title, description, tags, videoUrl, thumbnailUrl, posterUrl, durationSec, isActive, rowIds, details, notes };
      const saved = video
        ? await api<TvVideo>(`/api/dashboard/mitttv/videos/${video.id}`, 'PATCH', body)
        : await api<TvVideo>('/api/dashboard/mitttv/videos', 'POST', body);
      onSaved(saved);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={video ? 'Edit MittTV video' : 'Add a MittTV video'} kicker={video ? 'Edit video' : 'New video'} onClose={onClose} busy={busy} wide>
      <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr] gap-5">
        <div className="space-y-4">
          <div>
            <Label><span className="inline-flex items-center gap-1"><Film size={11} /> Video *</span></Label>
            <div onClick={() => !busy && videoRef.current?.click()}
              className="relative w-full aspect-video rounded-xl border-2 border-dashed border-gray-200 bg-gray-900/95 hover:border-[#004f9f]/50 cursor-pointer overflow-hidden flex items-center justify-center">
              {videoPreview
                ? <video src={videoPreview} className="w-full h-full object-contain" muted controls={videoProgress === null} />
                : <div className="flex flex-col items-center gap-1.5 text-gray-300 px-3 text-center"><UploadCloud size={22} /><span className="text-[11px] font-medium">Click to choose — MP4, MOV, M4V or WebM (landscape works best)</span></div>}
              {videoProgress !== null && (
                <div className="absolute inset-x-0 bottom-0 bg-black/70 px-3 py-2">
                  <div className="h-1.5 rounded-full bg-white/30 overflow-hidden"><div className="h-full bg-white transition-all" style={{ width: `${videoProgress}%` }} /></div>
                  <p className="text-[10px] text-white mt-1 text-center">Uploading… {videoProgress}%</p>
                </div>
              )}
              <input ref={videoRef} type="file" accept="video/mp4,video/quicktime,video/x-m4v,video/webm" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) pickVideo(f); e.target.value = ''; }} />
            </div>
            {videoUrl && videoProgress === null && (
              <p className="text-[10px] text-green-600 mt-1">✓ Video uploaded{durationSec ? ` · ${formatDuration(durationSec)}` : ''} — click to replace</p>
            )}
          </div>

          <div>
            <Label>Title *</Label>
            <input value={title} maxLength={MITTTV_LIMITS.title} onChange={(e) => setTitle(e.target.value)}
              placeholder="Shown on the card and in the player" className={inputCls} />
          </div>
          <div>
            <Label>Description (optional)</Label>
            <textarea value={description} maxLength={MITTTV_LIMITS.description} rows={3} onChange={(e) => setDescription(e.target.value)}
              placeholder="Shown on the banner and on the video's details page" className={`${inputCls} resize-none`} />
          </div>
          <div>
            <Label>Tags (optional)</Label>
            <input value={tags} maxLength={MITTTV_LIMITS.tags} onChange={(e) => setTags(e.target.value)}
              placeholder="e.g. story, animals, bedtime" className={inputCls} />
            <p className="text-[10px] text-gray-400 mt-1">Separate with commas. Used by search in the app, shown on the details page, and finds &quot;More like this&quot; videos.</p>
          </div>
          <DetailsEditor details={details} onChange={setDetails} />
          <NotesEditor notes={notes} onChange={setNotes} />
        </div>

        <div className="space-y-4">
          <div>
            <Label><span className="inline-flex items-center gap-1"><ImageIcon size={11} /> Thumbnail (wide)</span></Label>
            <div onClick={() => !busy && thumbRef.current?.click()}
              className="relative w-full aspect-video rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 hover:bg-gray-100 cursor-pointer overflow-hidden flex items-center justify-center">
              {thumbPreview
                ? <img src={thumbPreview} alt="" className="w-full h-full object-cover" />
                : <span className="text-[11px] text-gray-400 px-3 text-center">Made from the video automatically — or click to upload your own (16:9)</span>}
              {imageBusy === 'thumb' && <div className="absolute inset-0 bg-white/60 flex items-center justify-center"><Loader2 className="animate-spin text-[#004f9f]" size={18} /></div>}
              <input ref={thumbRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) pickImage(f, 'thumb'); e.target.value = ''; }} />
            </div>
          </div>
          <div>
            <Label>Poster (tall, optional)</Label>
            <div className="flex gap-3 items-start">
              <div onClick={() => !busy && posterRef.current?.click()}
                className="relative w-24 aspect-[2/3] rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 hover:bg-gray-100 cursor-pointer overflow-hidden flex items-center justify-center shrink-0">
                {posterPreview
                  ? <img src={posterPreview} alt="" className="w-full h-full object-cover" />
                  : <ImageIcon size={16} className="text-gray-300" />}
                {imageBusy === 'poster' && <div className="absolute inset-0 bg-white/60 flex items-center justify-center"><Loader2 className="animate-spin text-[#004f9f]" size={16} /></div>}
                <input ref={posterRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) pickImage(f, 'poster'); e.target.value = ''; }} />
              </div>
              <p className="text-[11px] text-gray-400">Used by rows with tall posters (2:3). Without one, those rows use the wide thumbnail.
                {posterUrl && <button type="button" onClick={() => { setPosterUrl(''); setPosterPreview(null); }} className="block mt-1 text-red-500 font-semibold">Remove poster</button>}
              </p>
            </div>
          </div>

          <div>
            <Label>Show in</Label>
            {rows.length === 0 ? (
              <p className="text-[11px] text-gray-400">No hand-picked rows yet (add them in Screen Rows). Automatic rows pick videos themselves.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {rows.map((r) => {
                  const on = rowIds.includes(r.id);
                  return (
                    <button key={r.id} type="button" onClick={() => setRowIds((p) => (on ? p.filter((x) => x !== r.id) : [...p, r.id]))}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${on ? 'bg-[#004f9f] text-white border-[#004f9f]' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                      {r.kind === 'BANNER' ? '★ Pin to banner' : r.title}
                    </button>
                  );
                })}
              </div>
            )}
            <p className="text-[10px] text-gray-400 mt-1.5">Every active video also appears in automatic rows like Newest and Most Watched.</p>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-gray-100 px-3 py-2.5">
            <Switch on={isActive} onChange={setIsActive} label="Show in app" />
            <div>
              <p className="text-sm font-semibold text-gray-700">{isActive ? 'Show in the app' : 'Hidden'}</p>
              <p className="text-[11px] text-gray-400">Hidden videos stay here but no one sees them.</p>
            </div>
          </div>
        </div>
      </div>

      {error && <div className="mt-4 flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2"><AlertCircle size={13} /> {error}</div>}

      <div className="flex gap-2 pt-5">
        <button onClick={onClose} disabled={busy} className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-sm font-semibold rounded-lg hover:bg-gray-50 disabled:opacity-50">Cancel</button>
        <button onClick={save} disabled={busy}
          className="flex-1 py-2.5 bg-[#004f9f] text-white text-sm font-bold rounded-lg hover:bg-[#003d7a] disabled:opacity-50 flex items-center justify-center gap-2">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Film size={14} />} {video ? 'Save Changes' : 'Publish'}
        </button>
      </div>
    </Modal>
  );
}

/**
 * Extra "label: value" lines for the video's details page in the app
 * (e.g. Language: Hindi, Age: 3–5 years). Saved in the video's meta.
 */
function DetailsEditor({ details, onChange }: { details: VideoDetail[]; onChange: (d: VideoDetail[]) => void }) {
  const set = (i: number, patch: Partial<VideoDetail>) => onChange(details.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  const full = details.length >= MITTTV_LIMITS.details;
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <Label>Extra details (optional)</Label>
        <button type="button" disabled={full} onClick={() => onChange([...details, { label: '', value: '' }])}
          className="inline-flex items-center gap-1 text-xs font-semibold text-[#004f9f] hover:underline disabled:opacity-40 disabled:no-underline">
          <Plus size={12} /> Add line
        </button>
      </div>
      {details.length === 0 ? (
        <p className="text-[11px] text-gray-400">Lines shown on the video&apos;s details page in the app, e.g. <b>Language: Hindi</b> or <b>Age: 3–5 years</b>.</p>
      ) : (
        <div className="space-y-1.5">
          {details.map((d, i) => (
            <div key={i} className="flex gap-1.5 items-center">
              <div className="w-[38%] shrink-0">
                <input value={d.label} maxLength={MITTTV_LIMITS.detailLabel} onChange={(e) => set(i, { label: e.target.value })}
                  placeholder="Label (Language)" className={inputCls} />
              </div>
              <div className="flex-1 min-w-0">
                <input value={d.value} maxLength={MITTTV_LIMITS.detailValue} onChange={(e) => set(i, { value: e.target.value })}
                  placeholder="Value (Hindi)" className={inputCls} />
              </div>
              <button type="button" title="Remove line" onClick={() => onChange(details.filter((_, j) => j !== i))}
                className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 shrink-0"><X size={14} /></button>
            </div>
          ))}
          <p className="text-[10px] text-gray-400">Lines without both a label and a value are not saved. Up to {MITTTV_LIMITS.details}.</p>
        </div>
      )}
    </div>
  );
}

/**
 * Free-text paragraphs for the video's details page in the app, shown just
 * above the Play / Resume button. Saved in the video's meta.
 */
function NotesEditor({ notes, onChange }: { notes: string[]; onChange: (n: string[]) => void }) {
  const full = notes.length >= MITTTV_LIMITS.notes;
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <Label>More text (optional)</Label>
        <button type="button" disabled={full} onClick={() => onChange([...notes, ''])}
          className="inline-flex items-center gap-1 text-xs font-semibold text-[#004f9f] hover:underline disabled:opacity-40 disabled:no-underline">
          <Plus size={12} /> Add text
        </button>
      </div>
      {notes.length === 0 ? (
        <p className="text-[11px] text-gray-400">Paragraphs shown just above the Play button on the video&apos;s details page, e.g. what children will learn from it.</p>
      ) : (
        <div className="space-y-2">
          {notes.map((n, i) => (
            <div key={i} className="flex gap-1.5 items-start">
              <div className="flex-1 min-w-0">
                <textarea value={n} maxLength={MITTTV_LIMITS.noteText} rows={3}
                  onChange={(e) => onChange(notes.map((x, j) => (j === i ? e.target.value : x)))}
                  placeholder={i === 0 ? 'e.g. In this song children learn the names of farm animals.' : 'Another paragraph'}
                  className={`${inputCls} resize-y`} />
                <p className="text-[10px] text-gray-400 text-right -mt-0.5">{n.length}/{MITTTV_LIMITS.noteText}</p>
              </div>
              <button type="button" title="Remove text" onClick={() => onChange(notes.filter((_, j) => j !== i))}
                className="p-1.5 mt-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 shrink-0"><X size={14} /></button>
            </div>
          ))}
          <p className="text-[10px] text-gray-400">Empty boxes are not saved. Up to {MITTTV_LIMITS.notes}.</p>
        </div>
      )}
    </div>
  );
}
