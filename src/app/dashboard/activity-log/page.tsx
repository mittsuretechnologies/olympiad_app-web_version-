'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { History, RefreshCw, Filter, X, ChevronLeft, ChevronRight, CheckCircle, XCircle, Trash2, Eye, Flag, Award, Star, Film, Play, Tag } from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

/** The clip an entry is about, joined server-side. Null when the entityId
 *  doesn't resolve to a video (a hard-deleted row, or a future non-video
 *  action) — the row then falls back to showing the raw id. */
interface LogVideo {
  id: string;
  thumbnailUrl: string | null;
  /** Signed on the server. Null when the clip was hard-deleted and only the
   *  audit snapshot survives — nothing left to play. */
  videoUrl: string | null;
  caption: string | null;
  category: string | null;
  subCategory: string | null;
  status: string;
  deleted: boolean;
  uploaderName: string | null;
  olympiadId: string | null;
  schoolName: string | null;
  /** True when the details came from a delete entry's snapshot rather than a
   *  live video row — there is no thumbnail to show in that case. */
  fromSnapshot?: boolean;
}

interface LogEntry {
  id: string;
  actorId: string;
  actorRole: string;
  actorName: string | null;
  /** Resolved from the actor's staff record at read time — null when the
   *  account has since been deleted and only the denormalised name survives. */
  actorEmail?: string | null;
  actorStaffId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  previousValue: string | null;
  newValue: string | null;
  reason: string | null;
  createdAt: string;
  video: LogVideo | null;
}

interface ListResponse {
  logs: LogEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const ACTION_CFG: Record<string, { label: string; icon: any; color: string }> = {
  VIDEO_APPROVED:        { label: 'Video Approved',       icon: CheckCircle, color: 'text-green-600 bg-green-50 border-green-100' },
  VIDEO_REJECTED:        { label: 'Video Rejected',       icon: XCircle,     color: 'text-red-600 bg-red-50 border-red-100' },
  VIDEO_RECATEGORIZED:   { label: 'Category Changed',     icon: Tag,         color: 'text-blue-600 bg-blue-50 border-blue-100' },
  VIDEO_DELETED:         { label: 'Video Deleted',        icon: Trash2,      color: 'text-red-700 bg-red-50 border-red-100' },
  VISIBILITY_CHANGED:    { label: 'Visibility Changed',   icon: Eye,         color: 'text-purple-600 bg-purple-50 border-purple-100' },
  REPORT_IGNORED:        { label: 'Report Ignored',       icon: Flag,        color: 'text-gray-600 bg-gray-50 border-gray-200' },
  REPORT_VIDEO_REMOVED:  { label: 'Reported Video Removed', icon: Flag,      color: 'text-red-700 bg-red-50 border-red-100' },
  EVALUATION_SUBMITTED:  { label: 'Evaluation Submitted',  icon: Star,       color: 'text-amber-600 bg-amber-50 border-amber-100' },
  EVALUATION_EDITED:     { label: 'Evaluation Edited',     icon: Star,       color: 'text-amber-600 bg-amber-50 border-amber-100' },
  EVALUATION_PUBLISHED:  { label: 'Evaluation Published',  icon: Award,      color: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
  EVALUATION_UNPUBLISHED:{ label: 'Evaluation Unpublished',icon: Award,      color: 'text-gray-600 bg-gray-50 border-gray-200' },
};

const ACTION_OPTIONS = Object.keys(ACTION_CFG);
const ROLE_OPTIONS = ['SUPERADMIN', 'MODERATOR', 'EVALUATOR', 'SCHOOL', 'REVIEWER'];

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

/** Split across two lines: the date is what the reader scans, the time only
 *  matters once they've found the day. */
function formatDateTime(iso: string) {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
    time: d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
  };
}

function tryParse(json: string | null): any {
  if (!json) return null;
  try { return JSON.parse(json); } catch { return json; }
}

/** Fields that identify the row rather than describe the change — showing them
 *  in a diff is noise, and the uuids among them are what made the old column
 *  unreadable. The clip column already answers "which video". */
// `category` / `subCategory` are deliberately NOT ignored: a moderator can
// recategorize a jury video while approving it, and that reassignment is a real
// change the log has to attribute. They only appear here when they actually
// differ, so an ordinary approve still shows just the status row.
const IGNORED_DIFF_KEYS = new Set(['id', 'appUserId', 'studentId', 'videoId', 'caption']);

/** Human wording for the fields that actually get changed. */
const FIELD_LABELS: Record<string, string> = {
  status: 'Status',
  rejectionReason: 'Reason',
  category: 'Category',
  subCategory: 'Sub-category',
  isEvaluation: 'Olympiad entry',
  olympiadVisibility: 'Visibility',
  isPublic: 'Public',
  isPublished: 'Published',
  resolved: 'Resolved',
  deletedAt: 'Deleted',
  coordinationScore: 'Coordination',
  memoryEnergyScore: 'Memory',
  imaginationEmotionScore: 'Imagination',
  focusLanguageScore: 'Focus',
  creativityJoyScore: 'Creativity',
  remarks: 'Remarks',
};

const SCORE_KEYS = [
  'coordinationScore', 'memoryEnergyScore', 'imaginationEmotionScore',
  'focusLanguageScore', 'creativityJoyScore',
];

function formatFieldValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (key === 'deletedAt') return 'Yes';
  return String(value);
}

interface FieldChange { key: string; label: string; before: string; after: string }

/**
 * Reduces the before/after snapshots to just the fields that actually differ.
 * The snapshots are whole-record dumps, so most keys are identical on both
 * sides — printing them all is what buried the one field the reader cares
 * about (usually status) under a wall of uuids.
 */
function diffSnapshots(previousValue: string | null, newValue: string | null): FieldChange[] {
  const before = tryParse(previousValue);
  const after  = tryParse(newValue);
  if (typeof before !== 'object' && typeof after !== 'object') return [];

  const keys = [...new Set([
    ...(before && typeof before === 'object' ? Object.keys(before) : []),
    ...(after && typeof after === 'object' ? Object.keys(after) : []),
  ])].filter(k => !IGNORED_DIFF_KEYS.has(k));

  const changes: FieldChange[] = [];
  for (const key of keys) {
    // A key absent from one side isn't a change — the snapshots are taken with
    // different `select`s, so an approve records isEvaluation only in the
    // before half. Treating that as "Yes → —" invented a change that never
    // happened, so a key has to be present on both sides to count.
    if (!before || !after) continue;
    if (!(key in before) || !(key in after)) continue;

    const b = before[key];
    const a = after[key];
    if (JSON.stringify(b) === JSON.stringify(a)) continue;
    changes.push({ key, label: FIELD_LABELS[key] ?? key, before: formatFieldValue(key, b), after: formatFieldValue(key, a) });
  }
  // Status first — it's the field the reader scans for.
  return changes.sort((x, y) => (x.key === 'status' ? -1 : y.key === 'status' ? 1 : 0));
}

/** Colours the two states of a status change so approve/reject reads at a glance. */
function stateTone(key: string, value: string): string {
  if (key !== 'status') return 'text-gray-600 bg-gray-100';
  if (value === 'APPROVED') return 'text-green-700 bg-green-50';
  if (value === 'REJECTED') return 'text-red-700 bg-red-50';
  if (value === 'PENDING')  return 'text-amber-700 bg-amber-50';
  return 'text-gray-600 bg-gray-100';
}

function ChangeCell({ log }: { log: LogEntry }) {
  const changes = diffSnapshots(log.previousValue, log.newValue);

  // A first evaluation has no previous snapshot to diff against, so the scores
  // it set are the whole story — showing "—" there would hide the only number
  // the row carries.
  if (changes.length === 0) {
    const after = tryParse(log.newValue);
    if (after && typeof after === 'object') {
      const scores = SCORE_KEYS.filter(k => after[k] != null);
      if (scores.length > 0) {
        const total = scores.reduce((sum, k) => sum + Number(after[k] || 0), 0);
        return (
          <div className="flex items-center gap-1.5 flex-wrap max-w-[230px]">
            {scores.map(k => (
              <span key={k} className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 text-[10px] font-bold" title={FIELD_LABELS[k] ?? k}>
                {(FIELD_LABELS[k] ?? k).slice(0, 4)} {String(after[k])}
              </span>
            ))}
            <span className="text-[10px] font-black text-gray-500">= {total}</span>
          </div>
        );
      }
    }
    return <span className="text-gray-300 text-[11px]">—</span>;
  }

  return (
    <div className="space-y-1">
      {changes.map(c => (
        <div key={c.key} className="flex items-center gap-1.5 text-[10px] whitespace-nowrap">
          <span className="text-gray-400 w-[62px] flex-shrink-0 truncate" title={c.label}>{c.label}</span>
          <span className={`px-1.5 py-0.5 rounded font-bold ${stateTone(c.key, c.before)}`}>{c.before}</span>
          <span className="text-gray-300">→</span>
          <span className={`px-1.5 py-0.5 rounded font-bold ${stateTone(c.key, c.after)}`}>{c.after}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Identifies the clip an entry acted on. The thumbnail is what makes a row
 * scannable — "which clip did they approve" is answered at a glance instead of
 * by copying a uuid into the video search. Caption falls back to the category
 * pair because most Olympiad uploads carry no caption at all.
 */
function ClipCell({ log, onPlay }: { log: LogEntry; onPlay: (v: LogVideo) => void }) {
  const video = log.video;

  if (!video) {
    return (
      <div>
        <p className="text-[11px] text-gray-500 font-mono">{log.entityType}</p>
        <p className="text-[10px] text-gray-400 font-mono">{log.entityId.slice(0, 8)}…</p>
      </div>
    );
  }

  const title = video.caption?.trim()
    || [video.category, video.subCategory].filter(Boolean).join(' · ')
    || 'Untitled clip';

  // A hard-deleted clip has no object left in storage, so its row shows the
  // details but isn't clickable — offering a play button that 404s would be
  // worse than not offering one.
  const playable = Boolean(video.videoUrl);

  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <button
        type="button"
        onClick={() => playable && onPlay(video)}
        disabled={!playable}
        title={playable ? 'Play clip' : 'This clip has been removed'}
        className={`group relative w-14 h-9 flex-shrink-0 rounded-md overflow-hidden bg-gray-100 border border-gray-200 ${
          playable ? 'cursor-pointer hover:border-[#014584]' : 'cursor-default'
        }`}
      >
        {video.thumbnailUrl ? (
          <img src={video.thumbnailUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Film size={13} className="text-gray-300" />
          </div>
        )}
        {playable && (
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Play size={13} className="text-white fill-current" />
          </div>
        )}
        {/* A removed clip still has a thumbnail, so the strike has to be said
            explicitly or the row reads as if the video is still live. */}
        {video.deleted && (
          <div className="absolute inset-0 bg-black/55 flex items-center justify-center">
            <Trash2 size={11} className="text-white" />
          </div>
        )}
      </button>
      <div className="min-w-0">
        <p className="text-[11px] font-bold text-gray-700 truncate max-w-[170px]" title={title}>{title}</p>
        <p className="text-[10px] text-gray-400 truncate max-w-[170px]">
          {video.uploaderName || 'Unknown uploader'}
          {video.olympiadId && <span className="font-mono"> · {video.olympiadId}</span>}
        </p>
      </div>
    </div>
  );
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function ActivityLogPage() {
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [entityIdFilter, setEntityIdFilter] = useState('');
  const [entityIdInput, setEntityIdInput] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [playing, setPlaying] = useState<LogVideo | null>(null);

  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('pageSize', '25');
  if (actionFilter) params.set('action', actionFilter);
  if (roleFilter) params.set('actorRole', roleFilter);
  if (entityIdFilter) params.set('entityId', entityIdFilter);

  const swrKey = `/api/dashboard/audit-log?${params.toString()}`;
  const { data, isLoading, mutate } = useSWR<ListResponse>(swrKey, authedFetcher);

  const logs = data?.logs ?? [];
  const activeFilters = [actionFilter, roleFilter, entityIdFilter].filter(Boolean).length;

  const applyEntityIdFilter = () => {
    setEntityIdFilter(entityIdInput.trim());
    setPage(1);
  };

  const clearFilters = () => {
    setActionFilter(''); setRoleFilter(''); setEntityIdFilter(''); setEntityIdInput('');
    setPage(1);
    setFilterOpen(false);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium text-[#004f9f]">Activity Log</h1>
          <p className="text-xs text-gray-500 mt-0.5">Every moderation & evaluation action — who did what, and when</p>
        </div>
        <button
          onClick={() => mutate()}
          className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-50 transition-colors shadow-sm"
        >
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative">
          <button
            onClick={() => setFilterOpen(o => !o)}
            className={`flex items-center gap-2 h-9 px-3.5 rounded-xl border text-xs font-bold transition-colors ${
              activeFilters ? 'border-[#014584] bg-[#014584]/5 text-[#014584]' : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
            }`}
          >
            <Filter size={13} />
            Filters
            {activeFilters > 0 && (
              <span className="w-4 h-4 rounded-full bg-[#014584] text-white text-[10px] font-black flex items-center justify-center">
                {activeFilters}
              </span>
            )}
          </button>

          {filterOpen && (
            <div className="absolute left-0 top-11 z-20 bg-white border border-gray-200 rounded-2xl shadow-lg p-4 w-72 space-y-3">
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Action</p>
                <select
                  value={actionFilter}
                  onChange={e => { setActionFilter(e.target.value); setPage(1); }}
                  className="w-full h-8 border border-gray-200 rounded-lg px-2 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#014584]/30"
                >
                  <option value="">All actions</option>
                  {ACTION_OPTIONS.map(a => <option key={a} value={a}>{ACTION_CFG[a].label}</option>)}
                </select>
              </div>
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Actor Role</p>
                <div className="flex flex-wrap gap-1.5">
                  {['', ...ROLE_OPTIONS].map(r => (
                    <button
                      key={r}
                      onClick={() => { setRoleFilter(r); setPage(1); }}
                      className={`px-2.5 h-7 rounded-lg text-[11px] font-bold border transition-colors ${
                        roleFilter === r ? 'bg-[#014584] text-white border-[#014584]' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      {r || 'All'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Video / Entity ID</p>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={entityIdInput}
                    onChange={e => setEntityIdInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && applyEntityIdFilter()}
                    placeholder="Paste an ID…"
                    className="flex-1 h-8 border border-gray-200 rounded-lg px-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#014584]/30"
                  />
                  <button onClick={applyEntityIdFilter} className="h-8 px-2.5 rounded-lg bg-[#014584] text-white text-[11px] font-bold">Go</button>
                </div>
              </div>
              {activeFilters > 0 && (
                <button onClick={clearFilters} className="w-full h-7 text-[11px] font-bold text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                  Clear all filters
                </button>
              )}
            </div>
          )}
        </div>

        {entityIdFilter && (
          <span className="flex items-center gap-1.5 text-[11px] font-bold text-[#014584] bg-[#014584]/5 border border-[#014584]/20 px-2.5 py-1.5 rounded-xl">
            Entity: {entityIdFilter.slice(0, 8)}…
            <button onClick={() => { setEntityIdFilter(''); setEntityIdInput(''); }}><X size={11} /></button>
          </span>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-16 text-gray-400 text-sm">Loading…</div>
      ) : logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 bg-white border border-dashed border-gray-200 rounded-2xl">
          <History size={40} className="text-gray-200 mb-3" />
          <p className="text-gray-400 font-bold text-sm">No activity recorded yet</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[640px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-4 py-2.5 text-[10px] font-black text-gray-400 uppercase tracking-widest">When</th>
                  <th className="px-4 py-2.5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Action</th>
                  <th className="px-4 py-2.5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Clip</th>
                  <th className="px-4 py-2.5 text-[10px] font-black text-gray-400 uppercase tracking-widest">By</th>
                  <th className="px-4 py-2.5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Change</th>
                  <th className="px-4 py-2.5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Reason</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => {
                  const cfg = ACTION_CFG[log.action] ?? { label: log.action, icon: History, color: 'text-gray-600 bg-gray-50 border-gray-200' };
                  const Icon = cfg.icon;
                  return (
                    <tr key={log.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap align-top">
                        <p className="text-[11px] font-semibold text-gray-600">{formatDateTime(log.createdAt).date}</p>
                        <p className="text-[10px] text-gray-400">{formatDateTime(log.createdAt).time}</p>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-full border ${cfg.color}`}>
                          <Icon size={10} /> {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <ClipCell log={log} onPlay={setPlaying} />
                      </td>
                      <td className="px-4 py-3 align-top">
                        <p className="text-[11px] font-bold text-gray-700 truncate max-w-[150px]" title={log.actorEmail || undefined}>
                          {log.actorName || log.actorId.slice(0, 8)}
                        </p>
                        {/* The staff id is what identifies a moderator across
                            the panel, so it earns the second line over the
                            email — which is on the name's tooltip instead. */}
                        <p className="text-[10px] text-gray-400">
                          {log.actorRole}
                          {log.actorStaffId && <span className="font-mono"> · {log.actorStaffId}</span>}
                        </p>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <ChangeCell log={log} />
                      </td>
                      <td className="px-4 py-3 align-top">
                        {log.reason
                          ? <p className="text-[11px] text-gray-500 max-w-[170px] leading-snug">{log.reason}</p>
                          : <span className="text-gray-300 text-[11px]">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <p className="text-[11px] text-gray-400">Page {data.page} of {data.totalPages} · {data.total} total</p>
              <div className="flex gap-1.5">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition-colors"
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}
                  disabled={page >= data.totalPages}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition-colors"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Player. The clip's identity is repeated in the header because the row
          it was opened from is hidden behind the overlay. */}
      {playing && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={() => setPlaying(null)}
        >
          <div
            className="bg-white rounded-2xl overflow-hidden max-w-2xl w-full shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-gray-100">
              <div className="min-w-0">
                <p className="text-sm font-bold text-gray-800 truncate">
                  {playing.caption?.trim()
                    || [playing.category, playing.subCategory].filter(Boolean).join(' · ')
                    || 'Untitled clip'}
                </p>
                <p className="text-[11px] text-gray-400 truncate">
                  {playing.uploaderName || 'Unknown uploader'}
                  {playing.olympiadId && <span className="font-mono"> · {playing.olympiadId}</span>}
                  {playing.schoolName && <span> · {playing.schoolName}</span>}
                </p>
              </div>
              <button
                onClick={() => setPlaying(null)}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors flex-shrink-0"
              >
                <X size={16} />
              </button>
            </div>
            {playing.videoUrl && (
              <video src={playing.videoUrl} controls autoPlay className="w-full max-h-[70vh] bg-black object-contain" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
