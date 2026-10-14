'use client';

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import {
  ShieldAlert, RefreshCw, Clock, CheckCircle, XCircle, Mail, Phone, Search, FileText, Link2, Save, AlertTriangle,
  Ban, Undo2, Trash2, CalendarClock, Unlink, Film,
} from 'lucide-react';
import { COPYRIGHT_REMOVED_NOTICE, COPYRIGHT_REVIEW_DAYS, formatReviewDate } from '@/lib/copyright';

// ─── Types ──────────────────────────────────────────────────────────────────

type Status = 'PENDING' | 'CONTENT_REMOVED' | 'REJECTED';

interface LinkedVideo {
  id: string;
  status: string;
  videoUrl: string;
  thumbnailUrl: string | null;
  caption: string | null;
  category: string | null;
  subCategory: string | null;
  deletedAt: string | null;
  createdAt: string;
  uploader: string | null;
}

interface Notice {
  id: string;
  referenceId: string;
  role: string;
  fullName: string;
  organisation: string | null;
  email: string;
  phone: string;
  videoLink: string;
  rightTypes: string;
  workTypes: string;
  noticeText: string;
  files: { name: string; kind: 'ownership' | 'authority'; contentType: string; size: number }[];
  emailSent: boolean;
  status: Status;
  adminNotes: string | null;
  resolvedAt: string | null;
  createdAt: string;
  video: LinkedVideo | null;
  videoDisabled: boolean;
  disabledAt: string | null;
  disabledByName: string | null;
  reviewDueAt: string | null;
  reviewOutcome: 'RESTORED' | 'REMOVED_PERMANENTLY' | null;
  reviewedAt: string | null;
}

interface ApiResponse {
  counts: Record<Status | 'REVIEW_DUE', number>;
  notices: Notice[];
}

type Filter = Status | 'REVIEW_DUE' | 'ALL';

type ReviewAction = 'RESTORE' | 'REMOVE' | 'EXTEND';

const REVIEW_ACTION_CFG: Record<ReviewAction, { label: string; help: string; button: string }> = {
  RESTORE: { label: 'Restore video', help: 'No court order was produced (Policy 6.3). The video goes live again and the uploader is told.', button: 'bg-green-600 hover:bg-green-700' },
  REMOVE:  { label: 'Remove permanently', help: 'A court order or a confirmed infringement. The video is deleted and the uploader is told.', button: 'bg-red-600 hover:bg-red-700' },
  EXTEND:  { label: 'Extend review', help: 'A court order is on its way. Keeps the video disabled until the new date.', button: 'bg-amber-500 hover:bg-amber-600' },
};

const DAY_MS = 24 * 60 * 60 * 1000;

// Open review = disabled for copyright and not yet restored/removed.
function isReviewOpen(n: Notice) {
  return !!n.disabledAt && !n.reviewOutcome;
}

function daysLeft(iso: string) {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / DAY_MS);
}

const VIDEO_STATUS_BADGE: Record<string, string> = {
  APPROVED: 'bg-green-50 text-green-700 border-green-200',
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  REJECTED: 'bg-gray-100 text-gray-600 border-gray-200',
  COPYRIGHT_DISABLED: 'bg-red-50 text-red-700 border-red-200',
};

function VideoCard({ video }: { video: LinkedVideo }) {
  const label = video.caption?.trim() || video.subCategory || video.category || 'Untitled video';
  return (
    <div className="flex gap-3 items-start">
      <a href={video.videoUrl} target="_blank" rel="noopener noreferrer" className="shrink-0" title="Watch">
        {video.thumbnailUrl
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={video.thumbnailUrl} alt="" className="w-16 h-24 object-cover rounded-lg border border-gray-200" />
          : <div className="w-16 h-24 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center"><Film size={18} className="text-gray-300" /></div>}
      </a>
      <div className="min-w-0 space-y-1">
        <p className="text-sm font-bold text-gray-800 truncate">{label}</p>
        <p className="text-[11px] text-gray-500">By <span className="font-semibold text-gray-700">{video.uploader || 'unknown'}</span> · uploaded {formatDate(video.createdAt)}</p>
        <p className="text-[10px] font-mono text-gray-400 break-all">{video.id}</p>
        <div className="flex gap-1.5 flex-wrap">
          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${VIDEO_STATUS_BADGE[video.status] ?? VIDEO_STATUS_BADGE.REJECTED}`}>
            {video.status === 'COPYRIGHT_DISABLED' ? 'Disabled for copyright' : video.status}
          </span>
          {video.deletedAt && (
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full border bg-gray-100 text-gray-600 border-gray-200">Deleted</span>
          )}
          <a href={video.videoUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] font-semibold text-[#004f9f] underline">Watch</a>
        </div>
      </div>
    </div>
  );
}

function ReviewDueChip({ dueAt }: { dueAt: string }) {
  const d = daysLeft(dueAt);
  const cls = d <= 0 ? 'bg-red-50 text-red-700 border-red-200'
    : d <= 2 ? 'bg-amber-50 text-amber-700 border-amber-200'
    : 'bg-blue-50 text-[#004f9f] border-blue-100';
  const text = d < 0 ? `Review overdue by ${-d} day${d === -1 ? '' : 's'}` : d === 0 ? 'Review due today' : `Review in ${d} day${d === 1 ? '' : 's'}`;
  return (
    <span className={`flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full border ${cls}`}>
      <CalendarClock size={9} /> {text}
    </span>
  );
}

const STATUS_CFG: Record<Status, { label: string; activeClass: string; badge: string; icon: typeof Clock }> = {
  PENDING:         { label: 'Pending',         activeClass: 'bg-amber-500 text-white shadow-sm', badge: 'bg-amber-50 text-amber-700 border-amber-200', icon: Clock },
  CONTENT_REMOVED: { label: 'Content Removed', activeClass: 'bg-green-600 text-white shadow-sm', badge: 'bg-green-50 text-green-700 border-green-200', icon: CheckCircle },
  REJECTED:        { label: 'Rejected',        activeClass: 'bg-gray-600 text-white shadow-sm',  badge: 'bg-gray-100 text-gray-600 border-gray-200',  icon: XCircle },
};

function getAuthToken() {
  if (typeof window === 'undefined') return '';
  return sessionStorage.getItem('token') || '';
}

function authedFetcher(url: string) {
  return fetch(url, { headers: { Authorization: `Bearer ${getAuthToken()}` } }).then(async r => {
    if (!r.ok) {
      const data = await r.json().catch(() => ({}));
      throw new Error(data.message || 'Request failed');
    }
    return r.json();
  });
}

function formatDate(iso: string | null) {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function InfringementNoticesPage() {
  const [filter, setFilter] = useState<Filter>('PENDING');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [notesDrafts, setNotesDrafts] = useState<Record<string, string>>({});
  // Link video: what was pasted, and the video it resolved to (shown before linking).
  const [linkInput, setLinkInput] = useState<Record<string, string>>({});
  const [linkPreview, setLinkPreview] = useState<Record<string, LinkedVideo | null>>({});
  // Disable-for-copyright confirmation, and the open review form.
  const [confirmDisable, setConfirmDisable] = useState<string | null>(null);
  const [disableNote, setDisableNote] = useState('');
  const [reviewForm, setReviewForm] = useState<{ noticeId: string; action: ReviewAction; reason: string; dueAt: string } | null>(null);

  const swrKey = `/api/dashboard/infringement-notices${filter !== 'ALL' ? `?status=${filter}` : ''}`;
  const { data, isLoading, error, mutate } = useSWR<ApiResponse>(swrKey, authedFetcher);

  const counts = data?.counts ?? { PENDING: 0, CONTENT_REMOVED: 0, REJECTED: 0, REVIEW_DUE: 0 };

  // Sends a dashboard request; shows the server's message on failure. Returns the JSON body or null.
  const send = async (noticeId: string, path: string, method: string, body?: unknown) => {
    setUpdatingId(noticeId);
    try {
      const res = await fetch(`/api/dashboard/infringement-notices/${noticeId}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAuthToken()}` },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(json.message || 'Request failed');
        return null;
      }
      return json;
    } finally {
      setUpdatingId(null);
    }
  };

  const findVideo = async (noticeId: string) => {
    const q = (linkInput[noticeId] || '').trim();
    if (!q) return;
    const json = await send(noticeId, `/video?q=${encodeURIComponent(q)}`, 'GET');
    setLinkPreview(prev => ({ ...prev, [noticeId]: json?.video ?? null }));
  };

  const linkVideo = async (noticeId: string) => {
    if (!(await send(noticeId, '/video', 'POST', { video: linkInput[noticeId] }))) return;
    setLinkInput(prev => ({ ...prev, [noticeId]: '' }));
    setLinkPreview(prev => ({ ...prev, [noticeId]: null }));
    mutate();
  };

  const unlinkVideo = async (noticeId: string) => {
    if (!confirm('Unlink this video from the notice?')) return;
    if (await send(noticeId, '/video', 'DELETE')) mutate();
  };

  const disableVideo = async (noticeId: string) => {
    if (!(await send(noticeId, '/disable', 'POST', { note: disableNote }))) return;
    setConfirmDisable(null);
    setDisableNote('');
    mutate();
  };

  const submitReview = async () => {
    if (!reviewForm) return;
    const { noticeId, action, reason, dueAt } = reviewForm;
    const body = action === 'EXTEND' ? { action, reason, dueAt: new Date(`${dueAt}T23:59:59+05:30`).toISOString() } : { action, reason };
    if (!(await send(noticeId, '/review', 'POST', body))) return;
    setReviewForm(null);
    mutate();
  };

  const notices = useMemo(() => {
    const all = data?.notices ?? [];
    if (!search.trim()) return all;
    const q = search.toLowerCase();
    return all.filter(n =>
      [n.referenceId, n.fullName, n.organisation, n.email, n.phone, n.videoLink, n.noticeText]
        .some(v => v?.toLowerCase().includes(q))
    );
  }, [data, search]);

  const update = async (noticeId: string, body: { status?: Status; adminNotes?: string }) => {
    setUpdatingId(noticeId);
    try {
      const res = await fetch(`/api/dashboard/infringement-notices/${noticeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAuthToken()}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        alert(json.message || 'Failed to update notice');
        return;
      }
      if (body.adminNotes !== undefined) setNotesDrafts(prev => { const next = { ...prev }; delete next[noticeId]; return next; });
      mutate();
    } finally {
      setUpdatingId(null);
    }
  };

  // The window is opened synchronously so the browser doesn't treat it as a popup.
  const openFile = async (noticeId: string, index: number) => {
    const win = window.open('', '_blank');
    try {
      const res = await fetch(`/api/dashboard/infringement-notices/${noticeId}/files/${index}`, {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      if (!res.ok) throw new Error();
      const url = URL.createObjectURL(await res.blob());
      if (win) win.location.href = url;
      else window.location.href = url;
    } catch {
      win?.close();
      alert('Could not open the file');
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium text-[#004f9f]">Report Infringement</h1>
          <p className="text-xs text-gray-500 mt-0.5">Copyright and trademark notices submitted on mittmee.com</p>
        </div>
        <button
          onClick={() => mutate()}
          className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-50 transition-colors shadow-sm"
        >
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {(Object.keys(STATUS_CFG) as Status[]).map(s => (
          <button
            key={s}
            onClick={() => setFilter(filter === s ? 'ALL' : s)}
            className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-colors ${
              filter === s ? STATUS_CFG[s].activeClass : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <span className="text-xs font-bold uppercase tracking-wide">{STATUS_CFG[s].label}</span>
            <span className="text-lg font-black">{counts[s]}</span>
          </button>
        ))}
        {/* Copyright takedowns whose 21-day review is due within 2 days or overdue */}
        <button
          onClick={() => setFilter(filter === 'REVIEW_DUE' ? 'ALL' : 'REVIEW_DUE')}
          className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-colors ${
            filter === 'REVIEW_DUE' ? 'bg-red-600 text-white shadow-sm'
              : counts.REVIEW_DUE > 0 ? 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100'
              : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          <span className="text-xs font-bold uppercase tracking-wide flex items-center gap-1.5"><CalendarClock size={13} /> Review Due</span>
          <span className="text-lg font-black">{counts.REVIEW_DUE}</span>
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by reference, name, email, phone, video link…"
          className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#014584]/20"
        />
      </div>

      {/* List */}
      {isLoading ? (
        <div className="text-center py-16 text-gray-400 text-sm">Loading...</div>
      ) : error ? (
        <div className="text-center py-16 text-red-500 text-sm">{error.message}</div>
      ) : notices.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm flex flex-col items-center gap-2">
          <ShieldAlert size={28} className="text-gray-300" />
          {filter === 'REVIEW_DUE'
            ? 'No copyright reviews due.'
            : `No infringement notices${filter !== 'ALL' ? ` in "${STATUS_CFG[filter].label}"` : ''}.`}
        </div>
      ) : (
        <div className="space-y-3">
          {notices.map(n => {
            const isOpenRow = expanded === n.id;
            const busy = updatingId === n.id;
            const cfg = STATUS_CFG[n.status] ?? STATUS_CFG.PENDING;
            const StatusIcon = cfg.icon;
            const notesValue = notesDrafts[n.id] ?? n.adminNotes ?? '';
            const reviewOpen = isReviewOpen(n);
            const preview = linkPreview[n.id];
            const form = reviewForm?.noticeId === n.id ? reviewForm : null;
            return (
              <div key={n.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                {/* Row header */}
                <button
                  onClick={() => setExpanded(isOpenRow ? null : n.id)}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-red-50 text-red-500">
                    <ShieldAlert size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-black text-[#004f9f] truncate">{n.fullName}</p>
                      <span className="text-[10px] font-mono font-bold text-gray-500 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded-full shrink-0">
                        {n.referenceId}
                      </span>
                      <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full shrink-0">
                        {n.rightTypes}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 truncate mt-0.5">{n.videoLink}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full border ${cfg.badge}`}>
                      <StatusIcon size={9} /> {cfg.label}
                    </span>
                    {reviewOpen && n.reviewDueAt && <ReviewDueChip dueAt={n.reviewDueAt} />}
                    <span className="text-[10px] text-gray-400">{formatDate(n.createdAt)}</span>
                  </div>
                </button>

                {/* Expanded detail */}
                {isOpenRow && (
                  <div className="border-t border-gray-100 p-4 space-y-3 bg-[#F8FAFF]">
                    {/* Contact */}
                    <div className="flex flex-wrap gap-3 text-xs text-gray-600">
                      <a href={`mailto:${n.email}?subject=${encodeURIComponent(`Your infringement notice ${n.referenceId}`)}`} className="flex items-center gap-1 hover:text-[#004f9f]">
                        <Mail size={12} className="text-gray-400" /> {n.email}
                      </a>
                      <span className="flex items-center gap-1"><Phone size={12} className="text-gray-400" /> {n.phone}</span>
                      {n.organisation && <span className="text-gray-400">Organisation: <span className="text-gray-600">{n.organisation}</span></span>}
                      <span className="text-gray-400">Submitting as: <span className="text-gray-600">{n.role}</span></span>
                    </div>

                    {!n.emailSent && (
                      <p className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                        <AlertTriangle size={12} /> This notice was not delivered to the grievance inbox by email — it exists only here.
                      </p>
                    )}

                    {/* Reported video */}
                    <p className="flex items-center gap-1.5 text-xs text-gray-600 break-all">
                      <Link2 size={12} className="text-gray-400 shrink-0" />
                      Reported video:{' '}
                      {/^https?:\/\//i.test(n.videoLink)
                        ? <a href={n.videoLink} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#004f9f] underline">{n.videoLink}</a>
                        : <span className="font-mono font-semibold">{n.videoLink}</span>}
                    </p>

                    {/* Linked video + copyright takedown */}
                    <div className="bg-white border border-gray-200 rounded-xl p-3 space-y-3">
                      <p className="text-[11px] font-bold text-gray-500 flex items-center gap-1"><Film size={12} /> Video in the app</p>

                      {n.video ? (
                        <VideoCard video={n.video} />
                      ) : (
                        <div className="space-y-2">
                          <p className="text-xs text-gray-500">Not linked. Paste the video ID or a link that contains it.</p>
                          <div className="flex gap-2">
                            <input
                              value={linkInput[n.id] ?? ''}
                              onChange={e => {
                                const value = e.target.value;
                                setLinkInput(prev => ({ ...prev, [n.id]: value }));
                                setLinkPreview(prev => ({ ...prev, [n.id]: null }));
                              }}
                              placeholder="e.g. 3f2c1a9e-…"
                              className="flex-1 text-sm font-mono border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#014584]/20"
                            />
                            <button
                              onClick={() => findVideo(n.id)}
                              disabled={busy || !(linkInput[n.id] || '').trim()}
                              className="px-4 py-2 rounded-xl bg-white border border-gray-200 text-xs font-black text-[#004f9f] hover:bg-blue-50 disabled:opacity-40"
                            >
                              Find
                            </button>
                          </div>
                          {preview && (
                            <div className="space-y-2">
                              <VideoCard video={preview} />
                              <button
                                onClick={() => linkVideo(n.id)}
                                disabled={busy}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#014584] hover:bg-[#013a6e] text-white text-xs font-black disabled:opacity-50"
                              >
                                <Link2 size={13} /> Link this video
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Takedown state */}
                      {reviewOpen && n.reviewDueAt && (
                        <div className="rounded-xl border border-red-200 bg-red-50 p-3 space-y-1">
                          <p className="text-xs font-black text-red-700 flex items-center gap-1.5 flex-wrap">
                            <Ban size={13} /> Disabled for copyright on {formatDate(n.disabledAt)}{n.disabledByName ? ` by ${n.disabledByName}` : ''}
                            <ReviewDueChip dueAt={n.reviewDueAt} />
                          </p>
                          <p className="text-[11px] text-red-700/80">
                            Review date: <b>{formatReviewDate(n.reviewDueAt)}</b>. Shown in the app in its place: “{COPYRIGHT_REMOVED_NOTICE}”
                          </p>
                        </div>
                      )}
                      {n.reviewOutcome && (
                        <p className="text-[11px] font-semibold text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                          Copyright review closed on {formatDate(n.reviewedAt)}: {n.reviewOutcome === 'RESTORED' ? 'video restored' : 'video removed permanently'}.
                        </p>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2 flex-wrap">
                        {n.video && !n.videoDisabled && !n.video.deletedAt && !reviewOpen && (
                          <button
                            onClick={() => { setConfirmDisable(n.id); setDisableNote(''); }}
                            disabled={busy}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-black disabled:opacity-50"
                          >
                            <Ban size={13} /> Disable for copyright
                          </button>
                        )}
                        {reviewOpen && (Object.keys(REVIEW_ACTION_CFG) as ReviewAction[]).map(a => (
                          <button
                            key={a}
                            onClick={() => setReviewForm({ noticeId: n.id, action: a, reason: '', dueAt: '' })}
                            disabled={busy}
                            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-xs font-black disabled:opacity-50 ${REVIEW_ACTION_CFG[a].button}`}
                          >
                            {a === 'RESTORE' ? <Undo2 size={13} /> : a === 'REMOVE' ? <Trash2 size={13} /> : <CalendarClock size={13} />}
                            {REVIEW_ACTION_CFG[a].label}
                          </button>
                        ))}
                        {n.video && !reviewOpen && (
                          <button
                            onClick={() => unlinkVideo(n.id)}
                            disabled={busy}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-gray-200 text-gray-600 text-xs font-black hover:bg-gray-50 disabled:opacity-50"
                          >
                            <Unlink size={13} /> Unlink
                          </button>
                        )}
                      </div>

                      {/* Disable confirmation */}
                      {confirmDisable === n.id && (
                        <div className="rounded-xl border border-red-200 bg-white p-3 space-y-2">
                          <p className="text-xs text-gray-700">
                            The video will be hidden everywhere in the app, and “{COPYRIGHT_REMOVED_NOTICE}” shown in its place.
                            It stays disabled for {COPYRIGHT_REVIEW_DAYS} days from the date of the notice — review on{' '}
                            <b>{formatReviewDate(new Date(new Date(n.createdAt).getTime() + COPYRIGHT_REVIEW_DAYS * DAY_MS))}</b>.
                            The uploader is notified in the app and by email.
                          </p>
                          <textarea
                            value={disableNote}
                            onChange={e => setDisableNote(e.target.value)}
                            placeholder="Note for the Audit Log (optional)"
                            rows={2}
                            className="w-full text-sm border border-gray-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-red-200 resize-none"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => disableVideo(n.id)}
                              disabled={busy}
                              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-black disabled:opacity-50"
                            >
                              <Ban size={13} /> Confirm — disable video
                            </button>
                            <button onClick={() => setConfirmDisable(null)} className="px-4 py-2 rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-50">
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Review form */}
                      {form && (
                        <div className="rounded-xl border border-gray-200 bg-white p-3 space-y-2">
                          <p className="text-xs font-black text-gray-700">{REVIEW_ACTION_CFG[form.action].label}</p>
                          <p className="text-[11px] text-gray-500">{REVIEW_ACTION_CFG[form.action].help}</p>
                          {form.action === 'EXTEND' && (
                            <label className="flex items-center gap-2 text-xs text-gray-600">
                              New review date
                              <input
                                type="date"
                                value={form.dueAt}
                                min={new Date(Date.now() + DAY_MS).toISOString().slice(0, 10)}
                                onChange={e => setReviewForm({ ...form, dueAt: e.target.value })}
                                className="border border-gray-200 rounded-lg px-2 py-1 text-sm"
                              />
                            </label>
                          )}
                          <textarea
                            value={form.reason}
                            onChange={e => setReviewForm({ ...form, reason: e.target.value })}
                            placeholder="Reason (required, kept in the Audit Log) — e.g. no court order received by the review date"
                            rows={2}
                            className="w-full text-sm border border-gray-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-[#014584]/20 resize-none"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={submitReview}
                              disabled={busy || !form.reason.trim() || (form.action === 'EXTEND' && !form.dueAt)}
                              className={`px-4 py-2 rounded-xl text-white text-xs font-black disabled:opacity-40 ${REVIEW_ACTION_CFG[form.action].button}`}
                            >
                              Confirm
                            </button>
                            <button onClick={() => setReviewForm(null)} className="px-4 py-2 rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-50">
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Proof documents */}
                    <div>
                      <p className="text-[11px] font-bold text-gray-500 mb-1.5 flex items-center gap-1">
                        <FileText size={12} /> Proof documents ({n.files.length})
                      </p>
                      <div className="flex gap-2 flex-wrap">
                        {n.files.map((f, i) => (
                          <button
                            key={i}
                            onClick={() => openFile(n.id, i)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-xs font-semibold text-[#004f9f] hover:bg-blue-50 transition-colors"
                          >
                            <FileText size={12} />
                            {f.kind === 'authority' ? 'Authority' : 'Ownership'} · {f.name} ({Math.ceil(f.size / 1024)} KB)
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Full notice */}
                    <div className="bg-white border border-gray-100 rounded-xl p-3 max-h-96 overflow-auto">
                      <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono">{n.noticeText}</pre>
                    </div>

                    {/* Internal notes */}
                    <div className="space-y-2">
                      <p className="text-[11px] font-bold text-gray-500">Internal notes (not shared with the complainant)</p>
                      <textarea
                        value={notesValue}
                        onChange={e => setNotesDrafts(prev => ({ ...prev, [n.id]: e.target.value }))}
                        placeholder="e.g. Video removed on 3 Oct, uploader informed…"
                        rows={3}
                        className="w-full text-sm border border-gray-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-[#014584]/20 resize-none"
                      />
                      <button
                        onClick={() => update(n.id, { adminNotes: notesValue })}
                        disabled={busy || notesDrafts[n.id] === undefined}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#014584] hover:bg-[#013a6e] text-white text-xs font-black transition-colors disabled:opacity-40"
                      >
                        <Save size={13} /> Save Notes
                      </button>
                    </div>

                    {/* Status actions */}
                    <div className="flex gap-2 pt-1 flex-wrap items-center">
                      {n.status !== 'CONTENT_REMOVED' && (
                        <button
                          onClick={() => update(n.id, { status: 'CONTENT_REMOVED' })}
                          disabled={busy}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white text-xs font-black transition-colors disabled:opacity-50"
                        >
                          <CheckCircle size={13} /> Mark Content Removed
                        </button>
                      )}
                      {n.status !== 'REJECTED' && !reviewOpen && (
                        <button
                          onClick={() => update(n.id, { status: 'REJECTED' })}
                          disabled={busy}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gray-600 hover:bg-gray-700 text-white text-xs font-black transition-colors disabled:opacity-50"
                        >
                          <XCircle size={13} /> Reject Notice
                        </button>
                      )}
                      {n.status !== 'PENDING' && !reviewOpen && (
                        <button
                          onClick={() => update(n.id, { status: 'PENDING' })}
                          disabled={busy}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-black transition-colors disabled:opacity-50"
                        >
                          <Clock size={13} /> Move back to Pending
                        </button>
                      )}
                      {n.resolvedAt && n.status !== 'PENDING' && (
                        <span className="text-[11px] text-gray-500">Closed on {formatDate(n.resolvedAt)}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
