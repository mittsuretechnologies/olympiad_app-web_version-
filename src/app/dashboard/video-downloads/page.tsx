'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Loader2, AlertCircle, Download, Search, Film, Eye, Heart, CheckSquare, Square, ChevronLeft, ChevronRight, Info, X,
} from 'lucide-react';

// SuperAdmin page: browse every uploaded video and download the original
// files — one at a time, or several selected at once. Downloads come straight
// from S3 through short-lived links (see /api/dashboard/video-downloads) and
// are recorded in the Activity Log.

interface VideoRow {
  id: string;
  caption: string | null;
  category: string | null;
  subCategory: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  uploaderType: string;
  isMittfest: boolean;
  isEvaluation: boolean;
  viewsCount: number;
  likesCount: number;
  createdAt: string;
  thumbnailUrl: string | null;
  uploader: { name: string | null; username: string | null; olympiadId: string | null; school: string | null };
}

const STATUS_STYLE: Record<string, string> = {
  APPROVED: 'bg-green-50 text-green-700 border-green-200',
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  REJECTED: 'bg-red-50 text-red-600 border-red-200',
};

const UPLOADER_LABEL: Record<string, string> = {
  STUDENT: 'Olympiad student',
  VIEWER: 'General user',
  SCHOOL: 'School upload',
};

function authHeaders(): Record<string, string> {
  const token = sessionStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Hands a URL to the browser as a download (the server marks it as an attachment). */
function triggerDownload(url: string) {
  const a = document.createElement('a');
  a.href = url;
  a.rel = 'noopener';
  a.download = '';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

async function getDownloadLink(id: string): Promise<string> {
  const res = await fetch(`/api/dashboard/video-downloads/${id}/link`, { headers: authHeaders() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Could not prepare the download');
  return data.url as string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function VideoDownloadsPage() {
  const [rows, setRows] = useState<VideoRow[]>([]);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(24);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // Filters
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [uploader, setUploader] = useState('');
  const [category, setCategory] = useState('');
  const [mittfest, setMittfest] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState<{ done: number; total: number } | null>(null);
  const [actionError, setActionError] = useState('');

  // Search waits for a pause in typing.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Any filter change goes back to page 1.
  useEffect(() => { setPage(1); }, [search, status, uploader, category, mittfest, from, to]);

  const load = useCallback(() => {
    setLoading(true);
    setLoadError('');
    const q = new URLSearchParams({ page: String(page) });
    if (search) q.set('search', search);
    if (status) q.set('status', status);
    if (uploader) q.set('uploader', uploader);
    if (category) q.set('category', category);
    if (mittfest) q.set('mittfest', '1');
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    fetch(`/api/dashboard/video-downloads?${q}`, { headers: authHeaders() })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.message || 'Failed to load videos');
        setRows(data.videos || []);
        setTotal(data.total || 0);
        setPageSize(data.pageSize || 24);
        setCategories((data.categories || []).filter(Boolean));
      })
      .catch((e) => setLoadError(e.message))
      .finally(() => setLoading(false));
  }, [page, search, status, uploader, category, mittfest, from, to]);

  useEffect(load, [load]);

  const pages = Math.max(1, Math.ceil(total / pageSize));
  const allOnPageSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const hasFilters = !!(searchInput || status || uploader || category || mittfest || from || to);

  const toggle = (id: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const togglePage = () => setSelected((prev) => {
    const next = new Set(prev);
    if (allOnPageSelected) rows.forEach((r) => next.delete(r.id));
    else rows.forEach((r) => next.add(r.id));
    return next;
  });

  const clearFilters = () => {
    setSearchInput(''); setStatus(''); setUploader(''); setCategory(''); setMittfest(false); setFrom(''); setTo('');
  };

  const downloadOne = async (id: string) => {
    setActionError('');
    setBusyIds((prev) => new Set(prev).add(id));
    try {
      triggerDownload(await getDownloadLink(id));
    } catch (e: any) {
      setActionError(e.message);
    } finally {
      setBusyIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
    }
  };

  // One file after another, with a short gap — browsers ignore downloads
  // fired all at once. Chrome asks once to "allow multiple downloads".
  const downloadSelected = async () => {
    const ids = [...selected];
    if (!ids.length) return;
    setActionError('');
    setBulk({ done: 0, total: ids.length });
    const failed: string[] = [];
    for (let i = 0; i < ids.length; i++) {
      try {
        triggerDownload(await getDownloadLink(ids[i]));
      } catch {
        failed.push(ids[i]);
      }
      setBulk({ done: i + 1, total: ids.length });
      if (i < ids.length - 1) await sleep(1200);
    }
    setBulk(null);
    if (failed.length) {
      setActionError(`${failed.length} of ${ids.length} videos could not be downloaded. They are still selected — try again.`);
      setSelected(new Set(failed));
    } else {
      setSelected(new Set());
    }
  };

  const fmtDate = (s: string) =>
    new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  const selectCls = 'h-9 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#004f9f]/20';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-medium text-[#004f9f]">Download Videos</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {loading ? 'Loading…' : `${total.toLocaleString('en-IN')} video${total === 1 ? '' : 's'}`}
            {hasFilters && !loading ? ' match the filters' : ''}
          </p>
        </div>
        <button onClick={downloadSelected} disabled={!selected.size || !!bulk}
          className="inline-flex items-center gap-2 bg-[#004f9f] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#003d7a] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
          {bulk
            ? <><Loader2 size={15} className="animate-spin" /> Downloading {bulk.done}/{bulk.total}…</>
            : <><Download size={15} /> Download selected{selected.size ? ` (${selected.size})` : ''}</>}
        </button>
      </div>

      <div className="flex items-start gap-2.5 rounded-xl border px-4 py-3 text-xs bg-gray-50 border-gray-100 text-gray-600">
        <Info size={14} className="mt-0.5 shrink-0" />
        <p>
          Downloads the original video file. Every download is recorded in the Activity Log. When downloading several
          videos at once, your browser may ask you to <strong>allow multiple downloads</strong> — choose Allow.
          Videos deleted by their uploader are not listed.
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search caption, username, Olympiad ID, student or school"
            className="w-full h-9 rounded-xl border border-gray-200 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#004f9f]/20" />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectCls}>
          <option value="">All statuses</option>
          <option value="APPROVED">Approved</option>
          <option value="PENDING">Pending</option>
          <option value="REJECTED">Rejected</option>
        </select>
        <select value={uploader} onChange={(e) => setUploader(e.target.value)} className={selectCls}>
          <option value="">All uploaders</option>
          <option value="STUDENT">Olympiad students</option>
          <option value="VIEWER">General users</option>
          <option value="SCHOOL">School uploads</option>
        </select>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className={selectCls}>
          <option value="">All categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <label className="inline-flex items-center gap-1.5 text-sm text-gray-600 px-2 cursor-pointer select-none">
          <input type="checkbox" checked={mittfest} onChange={(e) => setMittfest(e.target.checked)} className="accent-[#004f9f]" />
          MittFest only
        </label>
        <div className="inline-flex items-center gap-1.5 text-sm text-gray-500">
          <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className={selectCls} aria-label="Uploaded from" />
          to
          <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className={selectCls} aria-label="Uploaded to" />
        </div>
        {hasFilters && (
          <button onClick={clearFilters} className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-800 px-2">
            <X size={13} /> Clear
          </button>
        )}
      </div>

      {actionError && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600">
          <AlertCircle size={15} /> {actionError}
        </div>
      )}

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        {!loading && !loadError && rows.length > 0 && (
          <div className="flex items-center justify-between px-5 py-2.5 border-b border-gray-50 text-xs text-gray-500">
            <button onClick={togglePage} className="inline-flex items-center gap-2 font-semibold hover:text-gray-800">
              {allOnPageSelected ? <CheckSquare size={15} className="text-[#004f9f]" /> : <Square size={15} />}
              Select all on this page
            </button>
            {selected.size > 0 && (
              <button onClick={() => setSelected(new Set())} className="font-semibold hover:text-gray-800">
                Clear selection ({selected.size})
              </button>
            )}
          </div>
        )}

        {loading ? (
          <div className="py-20 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
        ) : loadError ? (
          <div className="py-16 flex flex-col items-center gap-2 text-red-500 text-sm"><AlertCircle size={18} /> {loadError}</div>
        ) : rows.length === 0 ? (
          <div className="py-20 flex flex-col items-center gap-2 text-gray-400 text-sm">
            <Film size={22} /> No videos {hasFilters ? 'match these filters' : 'uploaded yet'}.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
            {rows.map((r) => {
              const isSel = selected.has(r.id);
              const who = r.uploader.name || r.uploader.username || 'Unknown uploader';
              return (
                <div key={r.id}
                  className={`rounded-xl border overflow-hidden flex flex-col transition-colors ${isSel ? 'border-[#004f9f] ring-2 ring-[#004f9f]/15' : 'border-gray-100'}`}>
                  <div className="relative aspect-[9/16] max-h-72 bg-gray-100 cursor-pointer" onClick={() => toggle(r.id)}>
                    {r.thumbnailUrl
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={r.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center text-gray-300"><Film size={22} /></div>}
                    <span className="absolute top-2 left-2 bg-white/90 rounded-md p-0.5 shadow-sm">
                      {isSel ? <CheckSquare size={16} className="text-[#004f9f]" /> : <Square size={16} className="text-gray-500" />}
                    </span>
                    <span className={`absolute top-2 right-2 px-2 py-0.5 text-[10px] font-bold border rounded-full ${STATUS_STYLE[r.status] || ''}`}>
                      {r.status.charAt(0) + r.status.slice(1).toLowerCase()}
                    </span>
                    {r.isMittfest && (
                      <span className="absolute bottom-2 left-2 px-2 py-0.5 text-[10px] font-bold bg-violet-600 text-white rounded-full">MittFest</span>
                    )}
                  </div>
                  <div className="p-3 flex-1 flex flex-col gap-1.5">
                    <p className="text-sm font-medium text-gray-800 line-clamp-2 min-h-[2.5rem]">{r.caption || <span className="text-gray-400">No caption</span>}</p>
                    <p className="text-xs text-gray-600 truncate" title={who}>
                      {who}{r.uploader.username && r.uploader.name ? <span className="text-gray-400"> · @{r.uploader.username}</span> : null}
                    </p>
                    {(r.uploader.school || r.uploader.olympiadId) && (
                      <p className="text-[11px] text-gray-400 truncate" title={r.uploader.school || ''}>
                        {[r.uploader.olympiadId, r.uploader.school].filter(Boolean).join(' · ')}
                      </p>
                    )}
                    <p className="text-[11px] text-gray-400 truncate">
                      {[r.subCategory || r.category, UPLOADER_LABEL[r.uploaderType] || r.uploaderType].filter(Boolean).join(' · ')}
                    </p>
                    <div className="flex items-center gap-3 text-[11px] text-gray-400">
                      <span>{fmtDate(r.createdAt)}</span>
                      <span className="inline-flex items-center gap-1"><Eye size={11} /> {r.viewsCount}</span>
                      <span className="inline-flex items-center gap-1"><Heart size={11} /> {r.likesCount}</span>
                    </div>
                    <button onClick={() => downloadOne(r.id)} disabled={busyIds.has(r.id) || !!bulk}
                      className="mt-auto inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#004f9f]/5 text-[#004f9f] hover:bg-[#004f9f]/10 py-2 text-xs font-semibold transition-colors disabled:opacity-50">
                      {busyIds.has(r.id) ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />} Download
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!loading && !loadError && pages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-50 text-xs text-gray-500">
            <span>Page {page} of {pages}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 font-semibold hover:bg-gray-50 disabled:opacity-40">
                <ChevronLeft size={13} /> Previous
              </button>
              <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page >= pages}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 font-semibold hover:bg-gray-50 disabled:opacity-40">
                Next <ChevronRight size={13} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
