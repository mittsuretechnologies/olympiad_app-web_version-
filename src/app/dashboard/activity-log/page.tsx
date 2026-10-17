'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  History, X, Film, Play, Trash2, Search, Download, ChevronDown, Loader2, UserCog, GraduationCap,
  School, ListFilter, ShieldCheck, Copyright, Star, KeyRound, Eye, UserCheck, CalendarDays, Copy, Check,
  ArrowRight, FileText, RotateCcw,
} from 'lucide-react';
import {
  AUDIT_ACTIONS, AUDIT_CATEGORIES, ACTOR_ROLE_LABELS, AUDIT_MAX_RANGE_DAYS, auditActionDef,
  actionsInCategory, type AuditCategory, type AuditLookupMode, type AuditTone,
} from '@/lib/audit-actions';

// ─── Types ──────────────────────────────────────────────────────────────────

/** The clip a video entry is about, joined server-side. */
interface LogVideo {
  id: string;
  thumbnailUrl: string | null;
  /** Null when the clip was hard-deleted — nothing left to play. */
  videoUrl: string | null;
  caption: string | null;
  category: string | null;
  subCategory: string | null;
  status: string;
  deleted: boolean;
  uploaderName: string | null;
  olympiadId: string | null;
  schoolName: string | null;
  fromSnapshot?: boolean;
}

/** What a non-video entry acted on, resolved server-side. */
interface LogTarget {
  kind: string;
  name: string | null;
  sub: string | null;
  count?: number;
}

interface LogEntry {
  id: string;
  actorId: string;
  actorRole: string;
  actorName: string | null;
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
  target: LogTarget | null;
}

interface Subject {
  mode: AuditLookupMode;
  ref: string;
  name: string;
  sub: string | null;
  badge: string;
  thumbnailUrl?: string | null;
}

interface SubjectOption { ref: string; name: string; sub: string | null; badge: string }

interface Query {
  mode: AuditLookupMode;
  ref: string;
  from: string;
  to: string;
  category: AuditCategory | '';
}

interface Report {
  query: Query;
  subject: Subject;
  total: number;
  breakdown: Record<string, number>;
  logs: LogEntry[];
  nextCursor: string | null;
}

// ─── Config ─────────────────────────────────────────────────────────────────

const MODES: { key: AuditLookupMode; label: string; hint: string; icon: any; field: string; placeholder: string }[] = [
  { key: 'staff',   label: 'Staff member',  hint: 'Everything one person did',             icon: UserCog,       field: 'Staff member', placeholder: 'Type a name, email or staff ID…' },
  { key: 'student', label: 'Student',       hint: 'Everything done to a student or their videos', icon: GraduationCap, field: 'Student', placeholder: 'Olympiad ID, name, user ID or mobile…' },
  { key: 'school',  label: 'School',        hint: 'Everything about one school',           icon: School,        field: 'School', placeholder: 'School name, code or city…' },
  { key: 'video',   label: 'Video',         hint: 'Full history of one clip',              icon: Film,          field: 'Video ID', placeholder: 'Paste the video ID…' },
  { key: 'action',  label: 'Activity type', hint: 'Every time one kind of action happened', icon: ListFilter,   field: 'Activity', placeholder: '' },
];

const CATEGORY_ICONS: Record<AuditCategory, any> = {
  moderation: ShieldCheck,
  copyright: Copyright,
  evaluation: Star,
  credentials: KeyRound,
  dataAccess: Eye,
  accounts: UserCheck,
  schools: School,
  admins: UserCog,
};

const TONE: Record<AuditTone, { chip: string; dot: string }> = {
  success: { chip: 'text-emerald-700 bg-emerald-50 ring-emerald-100', dot: 'bg-emerald-500' },
  danger:  { chip: 'text-rose-700 bg-rose-50 ring-rose-100',          dot: 'bg-rose-500' },
  warning: { chip: 'text-amber-700 bg-amber-50 ring-amber-100',       dot: 'bg-amber-500' },
  info:    { chip: 'text-[#004f9f] bg-[#004f9f]/5 ring-[#004f9f]/10', dot: 'bg-[#004f9f]' },
  neutral: { chip: 'text-slate-600 bg-slate-100 ring-slate-200',      dot: 'bg-slate-400' },
};

const PRESETS = [
  { label: 'Today', days: 1 },
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
  { label: '1 year', days: 365 },
];

const EXPORT_LIMIT = 5000;

// ─── Helpers ────────────────────────────────────────────────────────────────

function getAuthToken() {
  if (typeof window === 'undefined') return '';
  return sessionStorage.getItem('token') || '';
}

async function authedJson<T>(url: string): Promise<T> {
  const r = await fetch(url, { headers: { Authorization: `Bearer ${getAuthToken()}` } });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.message || 'Request failed');
  return data as T;
}

function isoDay(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return isoDay(d);
}

function rangeDays(from: string, to: string) {
  return Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000) + 1;
}

const fmtDay = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const fmtShortDay = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

function tryParse(json: string | null): any {
  if (!json) return null;
  try { return JSON.parse(json); } catch { return json; }
}

// Fields that identify the row rather than describe the change.
// category / subCategory stay: a recategorise-while-approving is a real change.
const IGNORED_DIFF_KEYS = new Set(['id', 'appUserId', 'studentId', 'videoId', 'caption']);

const FIELD_LABELS: Record<string, string> = {
  status: 'Status',
  rejectionReason: 'Reason',
  category: 'Category',
  subCategory: 'Sub-category',
  isEvaluation: 'Olympiad entry',
  olympiadVisibility: 'Visibility',
  isPublic: 'Public',
  isPublished: 'Published',
  isActive: 'Active',
  resolved: 'Resolved',
  deletedAt: 'Deleted',
  coordinationScore: 'Coordination',
  memoryEnergyScore: 'Memory',
  imaginationEmotionScore: 'Imagination',
  focusLanguageScore: 'Focus',
  creativityJoyScore: 'Creativity',
  remarks: 'Remarks',
  name: 'Name',
  email: 'Email',
  mobile: 'Mobile',
  jobTitle: 'Job title',
  priority: 'Priority',
  examDate: 'Exam date',
};

const SCORE_KEYS = ['coordinationScore', 'memoryEnergyScore', 'imaginationEmotionScore', 'focusLanguageScore', 'creativityJoyScore'];

function formatFieldValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (key === 'deletedAt') return 'Yes';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

interface FieldChange { key: string; label: string; before: string; after: string }

/** Only the fields that differ — the snapshots are whole-record dumps. */
function diffSnapshots(previousValue: string | null, newValue: string | null): FieldChange[] {
  const before = tryParse(previousValue);
  const after = tryParse(newValue);
  if (!before || !after || typeof before !== 'object' || typeof after !== 'object') return [];

  const changes: FieldChange[] = [];
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (IGNORED_DIFF_KEYS.has(key)) continue;
    // Snapshots use different selects, so a key missing on one side isn't a change.
    if (!(key in before) || !(key in after)) continue;
    if (JSON.stringify(before[key]) === JSON.stringify(after[key])) continue;
    changes.push({ key, label: FIELD_LABELS[key] ?? key, before: formatFieldValue(key, before[key]), after: formatFieldValue(key, after[key]) });
  }
  return changes.sort((x, y) => (x.key === 'status' ? -1 : y.key === 'status' ? 1 : 0));
}

function stateTone(key: string, value: string): string {
  if (key !== 'status') return 'text-slate-600 bg-slate-100';
  if (value === 'APPROVED') return 'text-emerald-700 bg-emerald-50';
  if (value === 'REJECTED') return 'text-rose-700 bg-rose-50';
  if (value === 'PENDING') return 'text-amber-700 bg-amber-50';
  return 'text-slate-600 bg-slate-100';
}

function clipTitle(v: LogVideo) {
  return v.caption?.trim() || [v.category, v.subCategory].filter(Boolean).join(' · ') || 'Untitled clip';
}

/** One plain-text line naming what an entry acted on — shared by the row and the CSV. */
function targetText(log: LogEntry): { kind: string; name: string; sub: string } {
  if (log.video) {
    return {
      kind: 'Video',
      name: clipTitle(log.video),
      sub: [log.video.uploaderName, log.video.olympiadId, log.video.deleted ? 'deleted' : null].filter(Boolean).join(' · '),
    };
  }
  const t = log.target;
  if (!t) return { kind: log.entityType, name: log.entityId, sub: '' };
  if (log.entityId === 'LIST') {
    return { kind: t.kind, name: `${t.count ?? 'Several'} ${t.kind.toLowerCase()} record${t.count === 1 ? '' : 's'} (list)`, sub: '' };
  }
  return { kind: t.kind, name: t.name || `${log.entityId.slice(0, 8)}…`, sub: t.sub || '' };
}

function changeText(log: LogEntry): string {
  return diffSnapshots(log.previousValue, log.newValue).map((c) => `${c.label}: ${c.before} → ${c.after}`).join('; ');
}

function csvCell(v: unknown) {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function buildQueryString(q: Query, extra: Record<string, string> = {}) {
  const p = new URLSearchParams({ mode: q.mode, ref: q.ref, from: q.from, to: q.to, ...extra });
  if (q.category) p.set('category', q.category);
  return p.toString();
}

// ─── Subject picker (typeahead) ─────────────────────────────────────────────

function SubjectPicker({
  mode, placeholder, value, onChange,
}: {
  mode: 'staff' | 'student' | 'school';
  placeholder: string;
  value: SubjectOption | null;
  onChange: (o: SubjectOption | null) => void;
}) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<SubjectOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  // Debounced: only searches after the admin pauses, and only from 2 characters.
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setResults([]); setLoading(false); setError(''); return; }
    setLoading(true);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/dashboard/audit-log/lookup?type=${mode}&q=${encodeURIComponent(term)}`, {
          headers: { Authorization: `Bearer ${getAuthToken()}` }, signal: ctrl.signal,
        });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.message || 'Search failed');
        setResults(data.results ?? []);
        setError('');
        setActive(0);
      } catch (e: any) {
        if (e?.name !== 'AbortError') { setResults([]); setError(e?.message || 'Search failed'); }
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 350);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q, mode]);

  useEffect(() => {
    const close = (e: MouseEvent) => { if (!boxRef.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  if (value) {
    return (
      <div className="flex items-center gap-3 h-11 pl-3 pr-2 rounded-xl border border-[#004f9f]/30 bg-[#004f9f]/[0.03]">
        <div className="w-7 h-7 rounded-full bg-[#004f9f] text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0">
          {value.name.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-gray-800 truncate">{value.name}</p>
          <p className="text-[10px] text-gray-500 truncate">{value.badge}{value.sub ? ` · ${value.sub}` : ''}</p>
        </div>
        <button type="button" onClick={() => { onChange(null); setQ(''); }} className="p-1.5 rounded-lg text-gray-400 hover:bg-white hover:text-gray-600" title="Change">
          <X size={14} />
        </button>
      </div>
    );
  }

  const pick = (o: SubjectOption) => { onChange(o); setOpen(false); };

  return (
    <div className="relative" ref={boxRef}>
      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
      <input
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!open || results.length === 0) return;
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(results.length - 1, a + 1)); }
          if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
          if (e.key === 'Enter') { e.preventDefault(); pick(results[active]); }
        }}
        placeholder={placeholder}
        className="w-full h-11 pl-9 pr-9 rounded-xl border border-gray-200 bg-white text-[13px] text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#004f9f]/20 focus:border-[#004f9f]/40"
      />
      {loading && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" />}

      {open && q.trim().length >= 2 && !loading && (
        <div className="absolute z-30 left-0 right-0 top-12 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden max-h-80 overflow-y-auto">
          {error ? (
            <p className="px-4 py-3 text-xs text-rose-600">{error}</p>
          ) : results.length === 0 ? (
            <p className="px-4 py-3 text-xs text-gray-400">No match for “{q.trim()}”</p>
          ) : results.map((o, i) => (
            <button
              key={o.ref}
              type="button"
              onMouseEnter={() => setActive(i)}
              onClick={() => pick(o)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left ${i === active ? 'bg-[#004f9f]/5' : ''}`}
            >
              <div className="w-7 h-7 rounded-full bg-gray-100 text-gray-500 text-[11px] font-bold flex items-center justify-center flex-shrink-0">
                {o.name.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-gray-800 truncate">{o.name}</p>
                {o.sub && <p className="text-[11px] text-gray-400 truncate">{o.sub}</p>}
              </div>
              <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full flex-shrink-0">{o.badge}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Entry row ──────────────────────────────────────────────────────────────

function ChangeList({ log }: { log: LogEntry }) {
  const changes = diffSnapshots(log.previousValue, log.newValue);
  if (changes.length > 0) {
    return (
      <div className="space-y-1.5">
        {changes.map((c) => (
          <div key={c.key} className="flex items-center gap-2 text-[11px] flex-wrap">
            <span className="text-gray-400 w-24 flex-shrink-0">{c.label}</span>
            <span className={`px-1.5 py-0.5 rounded font-semibold ${stateTone(c.key, c.before)}`}>{c.before}</span>
            <ArrowRight size={11} className="text-gray-300" />
            <span className={`px-1.5 py-0.5 rounded font-semibold ${stateTone(c.key, c.after)}`}>{c.after}</span>
          </div>
        ))}
      </div>
    );
  }
  // A first evaluation has nothing to diff against — the scores are the story.
  const after = tryParse(log.newValue);
  if (after && typeof after === 'object') {
    const scores = SCORE_KEYS.filter((k) => after[k] != null);
    if (scores.length > 0) {
      const total = scores.reduce((sum, k) => sum + Number(after[k] || 0), 0);
      return (
        <div className="flex items-center gap-1.5 flex-wrap">
          {scores.map((k) => (
            <span key={k} className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 text-[11px] font-semibold">
              {FIELD_LABELS[k] ?? k}: {String(after[k])}
            </span>
          ))}
          <span className="text-[11px] font-bold text-gray-600">Total {total}</span>
        </div>
      );
    }
  }
  return null;
}

function CopyId({ value }: { value: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => { navigator.clipboard?.writeText(value).then(() => { setDone(true); setTimeout(() => setDone(false), 1200); }); }}
      className="inline-flex items-center gap-1 font-mono text-[10px] text-gray-500 hover:text-[#004f9f]"
      title="Copy"
    >
      {value.length > 18 ? `${value.slice(0, 18)}…` : value}
      {done ? <Check size={10} className="text-emerald-600" /> : <Copy size={10} />}
    </button>
  );
}

function EntryRow({ log, hideActor, onPlay }: { log: LogEntry; hideActor: boolean; onPlay: (v: LogVideo) => void }) {
  const [open, setOpen] = useState(false);
  const def = auditActionDef(log.action);
  const tone = TONE[def.tone];
  const Icon = CATEGORY_ICONS[def.category] ?? History;
  const target = targetText(log);
  const after = tryParse(log.newValue);
  const endpoint = after && typeof after === 'object' && typeof after.endpoint === 'string' ? after.endpoint : null;
  const changeCount = diffSnapshots(log.previousValue, log.newValue).length;
  const hasChanges = changeCount > 0;

  return (
    <li className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-start gap-3 sm:gap-4 px-4 sm:px-5 py-3.5 text-left hover:bg-gray-50/70 transition-colors"
      >
        <span className="w-12 flex-shrink-0 pt-1 text-[11px] font-semibold text-gray-400 tabular-nums">{fmtTime(log.createdAt)}</span>

        <span className={`mt-0.5 w-8 h-8 rounded-lg ring-1 flex items-center justify-center flex-shrink-0 ${tone.chip}`}>
          <Icon size={15} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-[13px] font-semibold text-gray-800">{def.label}</p>
            {hasChanges && <span className="text-[10px] font-semibold text-gray-400">· {changeCount} change{changeCount === 1 ? '' : 's'}</span>}
          </div>

          <div className="mt-1 flex items-center gap-2 min-w-0">
            {log.video && (
              <span className="relative w-10 h-7 rounded overflow-hidden bg-gray-100 border border-gray-200 flex-shrink-0">
                {log.video.thumbnailUrl
                  ? <img src={log.video.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                  : <Film size={11} className="absolute inset-0 m-auto text-gray-300" />}
                {log.video.deleted && <span className="absolute inset-0 bg-black/50 flex items-center justify-center"><Trash2 size={9} className="text-white" /></span>}
              </span>
            )}
            <p className="text-[12px] text-gray-600 truncate">
              <span className="text-gray-400">{target.kind}:</span> {target.name}
              {target.sub && <span className="text-gray-400"> · {target.sub}</span>}
            </p>
          </div>

          {!hideActor && (
            <p className="mt-1 text-[11px] text-gray-400 truncate">
              by <span className="font-semibold text-gray-600">{log.actorName || `${log.actorId.slice(0, 8)}…`}</span>
              {' · '}{ACTOR_ROLE_LABELS[log.actorRole] ?? log.actorRole}
              {log.actorStaffId && <span className="font-mono"> · {log.actorStaffId}</span>}
            </p>
          )}
        </div>

        <ChevronDown size={16} className={`mt-1.5 text-gray-300 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="mx-4 sm:ml-[7.25rem] sm:mr-5 mb-4 rounded-xl border border-gray-100 bg-gray-50/60 p-4 space-y-4">
          {(hasChanges || SCORE_KEYS.some((k) => after?.[k] != null)) && (
            <section>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">What changed</p>
              <ChangeList log={log} />
            </section>
          )}

          {log.reason && (
            <section>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Reason</p>
              <p className="text-[12px] text-gray-700 leading-relaxed">{log.reason}</p>
            </section>
          )}

          {log.video?.videoUrl && (
            <button
              type="button"
              onClick={() => onPlay(log.video!)}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-white border border-gray-200 text-[11px] font-bold text-[#004f9f] hover:border-[#004f9f]/40"
            >
              <Play size={12} className="fill-current" /> Play clip
            </button>
          )}

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-[11px]">
            <div><dt className="text-gray-400">When</dt><dd className="text-gray-700">{fmtDay(log.createdAt)}, {fmtTime(log.createdAt)}</dd></div>
            <div>
              <dt className="text-gray-400">Done by</dt>
              <dd className="text-gray-700">
                {log.actorName || 'Unknown'} ({ACTOR_ROLE_LABELS[log.actorRole] ?? log.actorRole})
                {log.actorEmail && <span className="text-gray-400"> · {log.actorEmail}</span>}
              </dd>
            </div>
            {endpoint && (
              <div className="sm:col-span-2"><dt className="text-gray-400">Screen / API</dt><dd className="font-mono text-[10px] text-gray-600 break-all">{endpoint}</dd></div>
            )}
            <div><dt className="text-gray-400">Record</dt><dd className="text-gray-700">{log.entityType} · {log.entityId === 'LIST' ? 'list' : <CopyId value={log.entityId} />}</dd></div>
            <div><dt className="text-gray-400">Log entry</dt><dd><CopyId value={log.id} /></dd></div>
          </dl>
        </div>
      )}
    </li>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function ActivityLogPage() {
  const [mode, setMode] = useState<AuditLookupMode>('staff');
  const [picked, setPicked] = useState<SubjectOption | null>(null);
  const [videoId, setVideoId] = useState('');
  const [actionRef, setActionRef] = useState('');
  const [from, setFrom] = useState(daysAgo(29));
  const [to, setTo] = useState(isoDay(new Date()));
  const [preset, setPreset] = useState<number | null>(30);
  const [category, setCategory] = useState<AuditCategory | ''>('');

  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [playing, setPlaying] = useState<LogVideo | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  const modeCfg = MODES.find((m) => m.key === mode)!;
  const ref = mode === 'video' ? videoId.trim() : mode === 'action' ? actionRef : picked?.ref ?? '';
  const days = rangeDays(from, to);
  const rangeError = from > to
    ? 'From date must be on or before To date.'
    : days > AUDIT_MAX_RANGE_DAYS ? `Pick at most ${AUDIT_MAX_RANGE_DAYS} days.` : '';
  const canSubmit = Boolean(ref) && !rangeError && !loading;

  const switchMode = (m: AuditLookupMode) => {
    if (m === mode) return;
    setMode(m); setPicked(null); setVideoId(''); setActionRef(''); setCategory(''); setError('');
    setReport(null);
  };

  // Back to an empty lookup: report gone, form reset to its defaults.
  const resetAll = () => {
    setReport(null); setError(''); setPicked(null); setVideoId(''); setActionRef(''); setCategory('');
    applyPreset(30);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const applyPreset = (n: number) => {
    setPreset(n);
    setFrom(daysAgo(n - 1));
    setTo(isoDay(new Date()));
  };

  const run = async (q: Query) => {
    setLoading(true); setError('');
    try {
      const data = await authedJson<Omit<Report, 'query'>>(`/api/dashboard/audit-log?${buildQueryString(q)}`);
      setReport({ ...data, query: q });
      requestAnimationFrame(() => reportRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    } catch (e: any) {
      setError(e?.message || 'Could not load the report');
      setReport(null);
    } finally {
      setLoading(false);
    }
  };

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!canSubmit) return;
    run({ mode, ref, from, to, category: mode === 'action' ? '' : category });
  };

  const loadMore = async () => {
    if (!report?.nextCursor) return;
    setLoadingMore(true);
    try {
      const data = await authedJson<{ logs: LogEntry[]; nextCursor: string | null }>(
        `/api/dashboard/audit-log?${buildQueryString(report.query, { cursor: report.nextCursor })}`,
      );
      setReport((r) => (r ? { ...r, logs: [...r.logs, ...data.logs], nextCursor: data.nextCursor } : r));
    } catch (e: any) {
      setError(e?.message || 'Could not load more');
    } finally {
      setLoadingMore(false);
    }
  };

  const exportCsv = async () => {
    if (!report) return;
    setExporting(true);
    try {
      const rows: LogEntry[] = [];
      let cursor: string | null = null;
      do {
        const extra: Record<string, string> = { export: '1' };
        if (cursor) extra.cursor = cursor;
        const data: { logs: LogEntry[]; nextCursor: string | null } =
          await authedJson(`/api/dashboard/audit-log?${buildQueryString(report.query, extra)}`);
        rows.push(...data.logs);
        cursor = data.nextCursor;
      } while (cursor && rows.length < EXPORT_LIMIT);

      const header = ['Date', 'Time', 'Activity', 'Category', 'Done by', 'Role', 'Staff ID', 'On (type)', 'On', 'Details', 'Changes', 'Reason', 'Record ID', 'Log ID'];
      const lines = rows.map((l) => {
        const def = auditActionDef(l.action);
        const t = targetText(l);
        return [
          fmtShortDay(l.createdAt), fmtTime(l.createdAt), def.label,
          AUDIT_CATEGORIES.find((c) => c.key === def.category)?.label ?? '',
          l.actorName ?? '', ACTOR_ROLE_LABELS[l.actorRole] ?? l.actorRole, l.actorStaffId ?? '',
          t.kind, t.name, t.sub, changeText(l), l.reason ?? '', l.entityId, l.id,
        ].map(csvCell).join(',');
      });
      // BOM so Excel reads names in Hindi/other scripts correctly.
      const blob = new Blob(['﻿' + [header.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      const slug = report.subject.name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 40) || 'report';
      a.href = URL.createObjectURL(blob);
      a.download = `activity-${slug}-${report.query.from}-to-${report.query.to}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e: any) {
      setError(e?.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  // Rows grouped under one heading per day.
  const groups = useMemo(() => {
    const out: { day: string; logs: LogEntry[] }[] = [];
    for (const l of report?.logs ?? []) {
      const day = isoDay(new Date(l.createdAt));
      if (out[out.length - 1]?.day !== day) out.push({ day, logs: [] });
      out[out.length - 1].logs.push(l);
    }
    return out;
  }, [report?.logs]);

  const categoryCounts = useMemo(() => {
    const counts: Partial<Record<AuditCategory, number>> = {};
    for (const [action, n] of Object.entries(report?.breakdown ?? {})) {
      const c = auditActionDef(action).category;
      counts[c] = (counts[c] ?? 0) + n;
    }
    return counts;
  }, [report?.breakdown]);
  const grandTotal = Object.values(report?.breakdown ?? {}).reduce((a, b) => a + b, 0);

  const filterCategory = (c: AuditCategory | '') => {
    if (!report) return;
    setCategory(c);
    run({ ...report.query, category: c });
  };

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-medium text-[#004f9f]">Activity Log</h1>
        <p className="text-xs text-gray-500 mt-0.5">Pick who or what you want to check, choose a period, and get its complete activity report.</p>
      </div>

      {/* Lookup */}
      <form onSubmit={submit} className="bg-white border border-gray-100 rounded-2xl shadow-sm">
        <div className="p-4 sm:p-5 border-b border-gray-100">
          <p className="text-[11px] font-bold text-gray-500 mb-2.5">1 · What do you want to look up?</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {MODES.map((m) => {
              const on = m.key === mode;
              const MIcon = m.icon;
              return (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => switchMode(m.key)}
                  className={`text-left rounded-xl border px-3 py-2.5 transition-colors ${
                    on ? 'border-[#004f9f] bg-[#004f9f]/[0.04] ring-1 ring-[#004f9f]/20' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <MIcon size={16} className={on ? 'text-[#004f9f]' : 'text-gray-400'} />
                  <p className={`mt-1.5 text-[12px] font-bold ${on ? 'text-[#004f9f]' : 'text-gray-700'}`}>{m.label}</p>
                  <p className="text-[10px] text-gray-400 leading-snug">{m.hint}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-5">
          <div className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-gray-500 mb-1.5">2 · {modeCfg.field} <span className="text-rose-500">*</span></label>
              {mode === 'staff' || mode === 'student' || mode === 'school' ? (
                <SubjectPicker key={mode} mode={mode} placeholder={modeCfg.placeholder} value={picked} onChange={setPicked} />
              ) : mode === 'video' ? (
                <div className="relative">
                  <Film size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    value={videoId}
                    onChange={(e) => setVideoId(e.target.value)}
                    placeholder={modeCfg.placeholder}
                    className="w-full h-11 pl-9 pr-3 rounded-xl border border-gray-200 text-[13px] font-mono focus:outline-none focus:ring-2 focus:ring-[#004f9f]/20 focus:border-[#004f9f]/40"
                  />
                  <p className="mt-1 text-[10px] text-gray-400">Tip: to see all of one student’s videos, use the Student lookup instead.</p>
                </div>
              ) : (
                <select
                  value={actionRef}
                  onChange={(e) => setActionRef(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl border border-gray-200 bg-white text-[13px] text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#004f9f]/20"
                >
                  <option value="">Choose an activity…</option>
                  {AUDIT_CATEGORIES.map((c) => (
                    <optgroup key={c.key} label={c.label}>
                      <option value={c.key}>All {c.label.toLowerCase()}</option>
                      {actionsInCategory(c.key).map((a) => <option key={a} value={a}>{AUDIT_ACTIONS[a].label}</option>)}
                    </optgroup>
                  ))}
                </select>
              )}
            </div>

            {mode !== 'action' && (
              <div>
                <label className="block text-[11px] font-bold text-gray-500 mb-1.5">Only this kind of activity <span className="font-normal text-gray-400">(optional)</span></label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as AuditCategory | '')}
                  className="w-full h-10 px-3 rounded-xl border border-gray-200 bg-white text-[13px] text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#004f9f]/20"
                >
                  <option value="">All activities</option>
                  {AUDIT_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
              </div>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-500 mb-1.5">3 · Period <span className="text-rose-500">*</span></label>
            <div className="flex flex-wrap gap-1.5 mb-2.5">
              {PRESETS.map((p) => (
                <button
                  key={p.days}
                  type="button"
                  onClick={() => applyPreset(p.days)}
                  className={`h-7 px-2.5 rounded-lg text-[11px] font-bold border transition-colors ${
                    preset === p.days ? 'bg-[#004f9f] text-white border-[#004f9f]' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-[10px] text-gray-400 mb-1">From</p>
                <input type="date" value={from} max={to} onChange={(e) => { setFrom(e.target.value); setPreset(null); }}
                  className="w-full h-10 px-2.5 rounded-xl border border-gray-200 text-[12px] text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#004f9f]/20" />
              </div>
              <div>
                <p className="text-[10px] text-gray-400 mb-1">To</p>
                <input type="date" value={to} min={from} max={isoDay(new Date())} onChange={(e) => { setTo(e.target.value); setPreset(null); }}
                  className="w-full h-10 px-2.5 rounded-xl border border-gray-200 text-[12px] text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#004f9f]/20" />
              </div>
            </div>
            <p className={`mt-1.5 text-[10px] ${rangeError ? 'text-rose-600' : 'text-gray-400'}`}>
              {rangeError || `${days} day${days === 1 ? '' : 's'} selected`}
            </p>
          </div>
        </div>

        <div className="px-4 sm:px-5 py-3.5 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl flex items-center justify-between gap-3">
          <p className="text-[11px] text-gray-400 hidden sm:block">
            {ref ? 'Ready — the report only loads this selection.' : `Choose a ${modeCfg.field.toLowerCase()} to continue.`}
          </p>
          {report && (
            <button
              type="button"
              onClick={resetAll}
              className="ml-auto inline-flex items-center gap-1.5 h-10 px-4 rounded-xl border border-gray-200 bg-white text-[13px] font-bold text-gray-600 hover:bg-gray-50"
            >
              <RotateCcw size={14} /> New search
            </button>
          )}
          <button
            type="submit"
            disabled={!canSubmit}
            className={`${report ? '' : 'ml-auto '}inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-[#004f9f] text-white text-[13px] font-bold hover:bg-[#003f80] disabled:opacity-40 disabled:cursor-not-allowed transition-colors`}
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />}
            Get report
          </button>
        </div>
      </form>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-[12px] text-rose-700">
          <X size={14} className="mt-0.5 flex-shrink-0" /> {error}
        </div>
      )}

      {/* Before the first search: what the log covers. */}
      {!report && !loading && (
        <div className="bg-white border border-dashed border-gray-200 rounded-2xl p-5 sm:p-6">
          <div className="flex items-center gap-2 mb-1">
            <History size={16} className="text-[#004f9f]" />
            <p className="text-[13px] font-bold text-gray-700">What the Activity Log records</p>
          </div>
          <p className="text-[11px] text-gray-400 mb-4">Nothing loads until you ask for a report, so this page stays fast.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
            {AUDIT_CATEGORIES.map((c) => {
              const CIcon = CATEGORY_ICONS[c.key];
              return (
                <div key={c.key} className="flex items-start gap-3">
                  <span className="w-8 h-8 rounded-lg bg-[#004f9f]/5 text-[#004f9f] flex items-center justify-center flex-shrink-0"><CIcon size={15} /></span>
                  <div>
                    <p className="text-[12px] font-semibold text-gray-700">{c.label}</p>
                    <p className="text-[11px] text-gray-400 leading-snug">{c.hint}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {loading && !report && (
        <div className="flex items-center justify-center gap-2 py-16 text-[12px] text-gray-400">
          <Loader2 size={16} className="animate-spin" /> Preparing report…
        </div>
      )}

      {/* Report */}
      {report && (
        <div ref={reportRef} className={`space-y-4 scroll-mt-4 ${loading ? 'opacity-60 pointer-events-none' : ''}`}>
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {report.subject.thumbnailUrl ? (
                  <img src={report.subject.thumbnailUrl} alt="" className="w-14 h-14 rounded-xl object-cover border border-gray-100 flex-shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-[#004f9f] text-white text-lg font-bold flex items-center justify-center flex-shrink-0">
                    {report.subject.name.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[15px] font-bold text-gray-800 truncate">{report.subject.name}</p>
                    <span className="text-[10px] font-bold text-[#004f9f] bg-[#004f9f]/5 px-2 py-0.5 rounded-full">{report.subject.badge}</span>
                  </div>
                  {report.subject.sub && <p className="text-[11px] text-gray-500 truncate">{report.subject.sub}</p>}
                  <p className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1">
                    <CalendarDays size={11} /> {fmtShortDay(report.query.from)} – {fmtShortDay(report.query.to)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-5 sm:gap-6">
                <div>
                  <p className="text-[10px] text-gray-400">Activities</p>
                  <p className="text-xl font-bold text-gray-800 tabular-nums">{grandTotal.toLocaleString('en-IN')}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400">Latest</p>
                  <p className="text-[12px] font-semibold text-gray-700">{report.logs[0] ? fmtShortDay(report.logs[0].createdAt) : '—'}</p>
                </div>
                <button
                  type="button"
                  onClick={exportCsv}
                  disabled={exporting || report.total === 0}
                  className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border border-gray-200 text-[12px] font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                  title={report.total > EXPORT_LIMIT ? `Downloads the latest ${EXPORT_LIMIT.toLocaleString('en-IN')}` : 'Download as Excel (CSV)'}
                >
                  {exporting ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />} CSV
                </button>
                <button
                  type="button"
                  onClick={() => { setReport(null); setError(''); }}
                  className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border border-gray-200 text-[12px] font-bold text-gray-600 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-100"
                  title="Close this report"
                >
                  <X size={13} /> Close
                </button>
              </div>
            </div>

            {grandTotal > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => filterCategory('')}
                  className={`h-7 px-2.5 rounded-lg text-[11px] font-bold border ${
                    !report.query.category ? 'bg-[#052E5C] text-white border-[#052E5C]' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  All · {grandTotal}
                </button>
                {AUDIT_CATEGORIES.filter((c) => categoryCounts[c.key]).map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => filterCategory(c.key)}
                    className={`h-7 px-2.5 rounded-lg text-[11px] font-bold border ${
                      report.query.category === c.key ? 'bg-[#052E5C] text-white border-[#052E5C]' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    {c.label} · {categoryCounts[c.key]}
                  </button>
                ))}
              </div>
            )}
          </div>

          {report.logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 bg-white border border-dashed border-gray-200 rounded-2xl">
              <History size={34} className="text-gray-200 mb-2" />
              <p className="text-[13px] font-bold text-gray-500">No activity in this period</p>
              <p className="text-[11px] text-gray-400 mt-0.5">Try a longer period or a different activity filter.</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
              {groups.map((g) => (
                <section key={g.day}>
                  <div className="px-4 sm:px-5 py-2 bg-gray-50 border-y border-gray-100 first:border-t-0 flex items-center justify-between">
                    <p className="text-[11px] font-bold text-gray-600">{fmtDay(g.logs[0].createdAt)}</p>
                    <p className="text-[10px] text-gray-400">{g.logs.length} shown</p>
                  </div>
                  <ul className="divide-y divide-gray-50">
                    {g.logs.map((l) => (
                      <EntryRow key={l.id} log={l} hideActor={report.query.mode === 'staff'} onPlay={setPlaying} />
                    ))}
                  </ul>
                </section>
              ))}

              <div className="px-4 sm:px-5 py-3 border-t border-gray-100 flex items-center justify-between gap-3">
                <p className="text-[11px] text-gray-400">
                  Showing {report.logs.length.toLocaleString('en-IN')} of {report.total.toLocaleString('en-IN')}
                </p>
                {report.nextCursor && (
                  <button
                    type="button"
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-lg border border-gray-200 text-[11px] font-bold text-[#004f9f] hover:bg-gray-50 disabled:opacity-50"
                  >
                    {loadingMore && <Loader2 size={12} className="animate-spin" />} Load more
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Player */}
      {playing && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setPlaying(null)}>
          <div className="bg-white rounded-xl overflow-hidden max-w-2xl w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-gray-100">
              <div className="min-w-0">
                <p className="text-sm font-bold text-gray-800 truncate">{clipTitle(playing)}</p>
                <p className="text-[11px] text-gray-400 truncate">
                  {playing.uploaderName || 'Unknown uploader'}
                  {playing.olympiadId && <span className="font-mono"> · {playing.olympiadId}</span>}
                  {playing.schoolName && <span> · {playing.schoolName}</span>}
                </p>
              </div>
              <button onClick={() => setPlaying(null)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 flex-shrink-0">
                <X size={16} />
              </button>
            </div>
            {playing.videoUrl && (
              <video src={playing.videoUrl} controls autoPlay controlsList="nodownload" disablePictureInPicture onContextMenu={(e) => e.preventDefault()} className="w-full max-h-[70vh] bg-black object-contain" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
