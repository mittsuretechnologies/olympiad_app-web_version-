'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle, BookOpen, CheckCircle2, Database, Eye, EyeOff, GraduationCap, Layers, Loader2, PlayCircle, RefreshCw, X,
} from 'lucide-react';
import type { ErpSettings } from '@/lib/mittTvShared';
import { api } from '../_lib/api';
import { Switch } from './common';

// MittTV → Class Content: the Mittsure ERP's digital content (Class → Series →
// Subject → Book → Chapter → videos), read live from the ERP — nothing is
// copied into Mittmee. Here the SuperAdmin switches it on for the app and
// chooses which classes, series and books show. Server: lib/mittTvErp.ts.

interface Overview {
  configured: boolean;
  filesUrl: string;
  settings: ErpSettings;
  row: { id: string; title: string; isVisible: boolean } | null;
  status: { ok: boolean; code: string | null; error: string | null; checkedAt: string | null };
  totals: { books: number; chapters: number; videos: number } | null;
  classes: { key: string; label: string; books: number; videos: number }[];
  series: { id: string; name: string; books: number; videos: number; classes: string[] }[];
}
interface ErpBookRow {
  id: string; name: string; subject: string; seriesId: string; seriesName: string; className: string; classLabel: string;
  posterUrl: string; chapters: number; videos: number; languages: string[];
}
interface ErpBookDetail {
  book: ErpBookRow;
  chapters: { id: string; no: number; name: string; description: string; videos: { id: string; language: string; label: string; fileName: string; url: string }[] }[];
}

const n = (v: number) => v.toLocaleString('en-IN');
const card = 'bg-white border border-gray-100 rounded-2xl shadow-sm';

export default function ClassContentTab({ onRowsChanged }: { onRowsChanged: () => void }) {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    setError('');
    try { setData(await api<Overview>(`/api/dashboard/mitttv/erp${refresh ? '?refresh=1' : ''}`)); }
    catch (e: any) { setError(e.message); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async (patch: Partial<ErpSettings>) => {
    if (!data) return;
    const hadRow = !!data.row;
    setSaving(true); setError('');
    // Show the change at once; the server's answer replaces it.
    setData({ ...data, settings: { ...data.settings, ...patch } });
    try {
      const next = await api<Overview>('/api/dashboard/mitttv/erp', 'PATCH', patch);
      setData(next);
      if (!hadRow && next.row) onRowsChanged();
    } catch (e: any) { setError(e.message); load(); }
    finally { setSaving(false); }
  };
  const toggleIn = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  if (loading) return <div className="py-20 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>;
  if (!data) {
    return (
      <div className="py-16 flex flex-col items-center gap-2 text-red-500 text-sm">
        <AlertCircle size={18} /> {error || 'Could not load the class content'}
        <button onClick={() => load()} className="text-xs text-[#004f9f] underline">Try again</button>
      </div>
    );
  }

  const s = data.settings;
  return (
    <div className="space-y-4">
      {/* Connection */}
      <div className={`${card} p-5`}>
        <div className="flex flex-wrap items-start gap-4">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#1FAE8E] to-[#3E82E0] text-white flex items-center justify-center shrink-0"><Database size={20} /></div>
          <div className="flex-1 min-w-[220px]">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-bold text-gray-800">Mittsure ERP · Digital Content</p>
              {data.status.ok ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full border bg-green-50 text-green-700 border-green-200"><CheckCircle2 size={11} /> Connected</span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full border bg-red-50 text-red-600 border-red-200"><AlertCircle size={11} /> Not connected</span>
              )}
            </div>
            <p className="text-[11px] text-gray-400 mt-1">
              Read live from the ERP — nothing is copied into Mittmee. Videos play straight from <span className="font-mono">{data.filesUrl.replace(/^https?:\/\//, '')}</span>.
              {data.status.checkedAt && <> Last read {new Date(data.status.checkedAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}; it re-reads every 5 minutes.</>}
            </p>
            {data.totals && (
              <div className="flex flex-wrap gap-2 mt-3">
                <Stat icon={BookOpen} label="Books with videos" value={n(data.totals.books)} />
                <Stat icon={Layers} label="Chapters" value={n(data.totals.chapters)} />
                <Stat icon={PlayCircle} label="Videos" value={n(data.totals.videos)} />
              </div>
            )}
          </div>
          <button onClick={() => load(true)} disabled={refreshing || !data.configured}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50">
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Read ERP now
          </button>
        </div>
        {!data.status.ok && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 space-y-1.5">
            <p className="font-semibold">{data.status.error}</p>
            {data.status.code === 'NOT_CONFIGURED' ? (
              <p>Add these to the Mittmee server&apos;s <span className="font-mono">.env</span> and restart it:
                <span className="block font-mono mt-1 text-[11px]">ERP_MONGODB_URI=mongodb://&lt;read-only user&gt;:&lt;password&gt;@&lt;ERP database host&gt;/&lt;database&gt;</span>
                <span className="block font-mono text-[11px]">ERP_FILES_URL=https://erp2.mittsure.com</span>
              </p>
            ) : (
              <p>Check that the ERP database is running and that this server is allowed to reach it, then click Read ERP now.</p>
            )}
          </div>
        )}
      </div>

      {error && <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2"><AlertCircle size={13} /> {error}</div>}

      {/* On / off */}
      <div className={`${card} p-5 flex items-start gap-4`}>
        <Switch on={s.enabled} disabled={saving || (!s.enabled && !data.status.ok)} label="Show class videos in MittTV" onChange={(v) => save({ enabled: v })} />
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-800">Show class videos in MittTV {s.enabled ? <span className="text-green-700">· On</span> : <span className="text-gray-400">· Off</span>}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Users get a <b>Learn by Class</b> row on the MittTV screen: class → series → subject → book → chapters, and class videos also show in MittTV search.
            Everything you leave switched on below is shown; new books added in the ERP appear by themselves.
          </p>
          {data.row ? (
            <p className={`text-[11px] mt-1.5 ${data.row.isVisible ? 'text-gray-500' : 'text-amber-700 font-semibold'}`}>
              {data.row.isVisible
                ? <>On the screen as the row &ldquo;{data.row.title}&rdquo;. Move or rename it in Screen Rows.</>
                : <>The row &ldquo;{data.row.title}&rdquo; is hidden in Screen Rows, so users won&apos;t see it there.</>}
            </p>
          ) : (
            <p className="text-[11px] text-gray-500 mt-1.5">Switching on adds the row right after Continue Watching.</p>
          )}
          <p className="text-[11px] text-gray-400 mt-1">Continue Watching and Resume work for class videos (only each user&apos;s position is saved). They have no view counts, so they don&apos;t appear in Most Watched or Top 10.</p>
        </div>
      </div>

      {data.status.ok && (
        <>
          {/* Classes */}
          <div className={`${card} p-5`}>
            <SectionHead icon={GraduationCap} title="Classes" hint="Click a class to show or hide it in the app." />
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
              {data.classes.map((c) => {
                const empty = c.videos === 0;
                const on = !empty && !s.hiddenClasses.includes(c.key);
                return (
                  <button key={c.key} type="button" disabled={empty || saving}
                    onClick={() => save({ hiddenClasses: toggleIn(s.hiddenClasses, c.key) })}
                    className={`text-left rounded-xl border px-3 py-2.5 transition-colors ${empty ? 'border-dashed border-gray-200 opacity-50 cursor-not-allowed' : on ? 'border-[#1FAE8E] bg-[#1FAE8E]/5 hover:bg-[#1FAE8E]/10' : 'border-gray-200 bg-gray-50 hover:bg-gray-100'}`}>
                    <span className="flex items-center justify-between gap-1">
                      <span className={`text-sm font-bold ${on ? 'text-gray-800' : 'text-gray-400'}`}>{c.label}</span>
                      {!empty && (on ? <Eye size={13} className="text-[#1FAE8E]" /> : <EyeOff size={13} className="text-gray-400" />)}
                    </span>
                    <span className="block text-[10px] text-gray-400 mt-0.5">{empty ? 'No videos' : `${c.books} books · ${n(c.videos)} videos`}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Series */}
          <div className={`${card} p-5`}>
            <SectionHead icon={Layers} title="Series" hint="A hidden series is left out of every class." />
            <div className="divide-y divide-gray-50">
              {data.series.map((sr) => {
                const empty = sr.videos === 0;
                return (
                  <div key={sr.id} className={`flex items-center gap-3 py-2.5 ${empty ? 'opacity-50' : ''}`}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-700">{sr.name}</p>
                      <p className="text-[11px] text-gray-400">
                        {empty ? 'No videos yet' : <>{sr.books} books · {n(sr.videos)} videos · {sr.classes.map(classShort).join(', ')}</>}
                      </p>
                    </div>
                    <Switch on={!empty && !s.hiddenSeries.includes(sr.id)} disabled={empty || saving} label={`Show ${sr.name}`}
                      onChange={() => save({ hiddenSeries: toggleIn(s.hiddenSeries, sr.id) })} />
                  </div>
                );
              })}
            </div>
          </div>

          <BooksBrowser data={data} saving={saving} onToggleBook={(id) => save({ hiddenBooks: toggleIn(s.hiddenBooks, id) })} />
        </>
      )}
    </div>
  );
}

const classShort = (key: string) => (/^\d+$/.test(key) ? key : key === 'NURSERY' ? 'Nur' : key);

function Stat({ icon: Icon, label, value }: { icon: typeof BookOpen; label: string; value: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-xl bg-gray-50 border border-gray-100 px-3 py-1.5">
      <Icon size={14} className="text-[#3E82E0]" />
      <span className="text-sm font-bold text-gray-800">{value}</span>
      <span className="text-[11px] text-gray-400">{label}</span>
    </div>
  );
}

function SectionHead({ icon: Icon, title, hint }: { icon: typeof BookOpen; title: string; hint: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon size={15} className="text-[#004f9f]" />
      <p className="text-sm font-bold text-gray-800">{title}</p>
      <p className="text-[11px] text-gray-400">{hint}</p>
    </div>
  );
}

/** Books of one class (and series), with a show/hide switch each and a chapter preview. */
function BooksBrowser({ data, saving, onToggleBook }: { data: Overview; saving: boolean; onToggleBook: (id: string) => void }) {
  const classes = data.classes.filter((c) => c.videos > 0);
  const [cls, setCls] = useState(classes[0]?.key ?? '');
  const [series, setSeries] = useState('');
  const [books, setBooks] = useState<ErpBookRow[] | null>(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState<ErpBookRow | null>(null);
  const s = data.settings;

  useEffect(() => {
    if (!cls) return;
    let alive = true;
    setBooks(null); setError('');
    api<{ books: ErpBookRow[] }>(`/api/dashboard/mitttv/erp/books?class=${encodeURIComponent(cls)}`)
      .then((d) => { if (alive) setBooks(d.books); })
      .catch((e) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [cls]);

  const seriesHere = useMemo(() => data.series.filter((sr) => (books ?? []).some((b) => b.seriesId === sr.id)), [data.series, books]);
  const shown = (books ?? []).filter((b) => !series || b.seriesId === series);

  return (
    <div className={`${card} p-5`}>
      <SectionHead icon={BookOpen} title="Books" hint="See what each class has, hide single books, and play any chapter." />
      <div className="flex flex-wrap gap-1.5 mb-2">
        {classes.map((c) => (
          <button key={c.key} onClick={() => { setCls(c.key); setSeries(''); }}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${cls === c.key ? 'bg-[#004f9f] text-white border-[#004f9f]' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
            {c.label}
          </button>
        ))}
      </div>
      {seriesHere.length > 1 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {[{ id: '', name: 'All series' }, ...seriesHere].map((sr) => (
            <button key={sr.id || 'all'} onClick={() => setSeries(sr.id)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${series === sr.id ? 'bg-[#1FAE8E]/10 text-[#13866c] border-[#1FAE8E]/40' : 'bg-gray-50 text-gray-500 border-gray-100 hover:bg-gray-100'}`}>
              {sr.name}
            </button>
          ))}
        </div>
      )}

      {error ? (
        <p className="text-xs text-red-500 py-6 text-center">{error}</p>
      ) : !books ? (
        <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-gray-300" /></div>
      ) : shown.length === 0 ? (
        <p className="text-xs text-gray-400 py-6 text-center">No books here.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
          {shown.map((b) => {
            const why = b.videos === 0 ? 'No videos yet'
              : s.hiddenClasses.includes(b.className) ? 'Class hidden'
                : s.hiddenSeries.includes(b.seriesId) ? 'Series hidden' : '';
            const on = !why && !s.hiddenBooks.includes(b.id);
            return (
              <div key={b.id} className={`flex gap-3 rounded-xl border border-gray-100 p-2.5 ${on ? '' : 'bg-gray-50/70'}`}>
                <button onClick={() => b.videos > 0 && setOpen(b)} title={b.videos > 0 ? 'See chapters and play' : undefined}
                  className={`w-14 h-[76px] shrink-0 rounded-lg overflow-hidden bg-gray-100 ${on ? '' : 'opacity-50'}`}>
                  {b.posterUrl
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={b.posterUrl} alt="" loading="lazy" className="w-full h-full object-cover" />
                    : <BookOpen size={18} className="m-auto mt-7 text-gray-300" />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-[#13866c] truncate">{b.subject}</p>
                  <p className={`text-sm font-semibold truncate ${on ? 'text-gray-800' : 'text-gray-400'}`} title={b.name}>{b.name}</p>
                  <p className="text-[11px] text-gray-400 truncate">{b.seriesName} · {b.chapters} chapters · {n(b.videos)} videos</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    {why ? <span className="text-[10px] font-semibold text-gray-400">{why}</span> : (
                      <>
                        <Switch on={on} disabled={saving} label={`Show ${b.name}`} onChange={() => onToggleBook(b.id)} />
                        <span className={`text-[11px] font-semibold ${on ? 'text-green-700' : 'text-gray-400'}`}>{on ? 'Shown' : 'Hidden'}</span>
                      </>
                    )}
                    {b.videos > 0 && (
                      <button onClick={() => setOpen(b)} className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold text-[#004f9f] hover:underline">
                        <PlayCircle size={12} /> Chapters
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {open && <BookPreview book={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

/** A book's chapters and videos, playing straight from the ERP server. */
function BookPreview({ book, onClose }: { book: ErpBookRow; onClose: () => void }) {
  const [detail, setDetail] = useState<ErpBookDetail | null>(null);
  const [error, setError] = useState('');
  const [playing, setPlaying] = useState<{ title: string; url: string } | null>(null);

  useEffect(() => {
    api<ErpBookDetail>(`/api/dashboard/mitttv/erp/books/${book.id}`).then(setDetail).catch((e) => setError(e.message));
  }, [book.id]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-100">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#13866c]">{book.classLabel} · {book.subject} · {book.seriesName}</p>
            <p className="text-base font-bold text-gray-800 truncate">{book.name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100" title="Close"><X size={18} /></button>
        </div>
        {playing && (
          <div className="bg-black">
            <video key={playing.url} src={playing.url} controls autoPlay className="w-full max-h-[40vh]" />
            <p className="text-xs text-white/80 px-4 py-2 truncate">{playing.title}</p>
          </div>
        )}
        <div className="overflow-y-auto p-5 space-y-2">
          {error ? <p className="text-xs text-red-500">{error}</p> : !detail ? (
            <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-gray-300" /></div>
          ) : detail.chapters.map((c, i) => (
            <div key={c.id} className="rounded-xl border border-gray-100 px-3.5 py-2.5">
              <div className="flex items-start gap-2.5">
                <span className="w-7 h-7 rounded-lg bg-[#004f9f]/10 text-[#004f9f] text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800">{c.name}</p>
                  {c.description && <p className="text-[11px] text-gray-400 line-clamp-2">{c.description}</p>}
                  {c.videos.length === 0 ? (
                    <p className="text-[11px] text-gray-400 mt-1">No videos — not shown in the app.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {c.videos.map((v) => {
                        const title = `${c.name}${v.label ? ` · ${v.label}` : ''} (${v.language})`;
                        const active = playing?.url === v.url;
                        return (
                          <button key={v.id} onClick={() => setPlaying({ title, url: v.url })} title={v.fileName}
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold border ${active ? 'bg-[#004f9f] text-white border-[#004f9f]' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                            <PlayCircle size={11} /> {v.language}{v.label ? ` · ${v.label}` : ''}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
