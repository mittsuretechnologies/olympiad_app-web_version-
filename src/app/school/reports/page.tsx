'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  ClipboardList, Users, UserCheck, UserX, Video, CheckCircle2, Clock, XCircle, Ban,
  Award, Search, Filter, Download, Heart, Eye, BookOpen,
} from 'lucide-react';
import { getCategoryDisplayLabel, OLYMPIAD_CAT_A_LABEL, OLYMPIAD_CAT_B_LABEL } from '@/lib/olympiad-categories';
import { CARD, STACK, INPUT, avatarTint, TABLE, TH, TD, TR, BTN_SUBTLE } from '../ui';
import {
  PageHeader, StatTile, StatusBadge, FilterPill, Avatar,
  LoadingState, ErrorState, EmptyState, TableShell, RowCount,
} from '../components';

type SlotStatus = 'empty' | 'pending' | 'approved' | 'rejected';
type EvalStatus = 'not_applicable' | 'pending' | 'evaluated' | 'published';

interface SlotReport {
  status: SlotStatus;
  subCategory: string | null;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  rejectionReason: string | null;
  tags: string | null;
  likesCount: number;
  viewsCount: number;
  createdAt: string | null;
  evaluationStatus: EvalStatus;
  totalScore: number | null;
  percent: number | null;
}

interface ReportRow {
  key: string;
  name: string;
  phone: string | null;
  username: string | null;
  olympiadCode: string;
  classCode: string | null;
  className: string | null;
  source: 'web' | 'app' | null;
  registrationStatus: 'registered' | 'pending';
  isVerified: boolean;
  registeredAt: string | null;
  allocatedAt: string;
  slotA: SlotReport;
  slotB: SlotReport;
}

/** Row-level verdict: driven by upload completeness first, evaluation state layered on top. */
type Verdict = 'not_registered' | 'no_uploads' | 'partial_upload' | 'awaiting_review' | 'rejected' | 'awaiting_evaluation' | 'evaluated' | 'result_published';

function rowVerdict(r: ReportRow): Verdict {
  if (r.registrationStatus === 'pending') return 'not_registered';
  const a = r.slotA, b = r.slotB;
  if (a.status === 'empty' && b.status === 'empty') return 'no_uploads';
  if (a.status === 'rejected' || b.status === 'rejected') return 'rejected';
  if (a.status !== 'approved' || b.status !== 'approved') {
    if (a.status === 'pending' || b.status === 'pending') return 'awaiting_review';
    return 'partial_upload';
  }
  // Both approved — look at evaluation
  if (a.evaluationStatus === 'published' && b.evaluationStatus === 'published') return 'result_published';
  if (a.evaluationStatus !== 'not_applicable' && a.evaluationStatus !== 'pending' && b.evaluationStatus !== 'not_applicable' && b.evaluationStatus !== 'pending') return 'evaluated';
  return 'awaiting_evaluation';
}

const VERDICT_META: Record<Verdict, { label: string; tone: 'success' | 'warning' | 'danger' | 'info' | 'neutral'; icon: any }> = {
  not_registered:       { label: 'Not registered',       tone: 'neutral', icon: UserX },
  no_uploads:            { label: 'No uploads',           tone: 'neutral', icon: Video },
  partial_upload:        { label: 'Partial upload',       tone: 'warning', icon: Clock },
  awaiting_review:       { label: 'Awaiting review',      tone: 'warning', icon: Clock },
  rejected:              { label: 'Rejected — reupload',  tone: 'danger',  icon: XCircle },
  awaiting_evaluation:   { label: 'Awaiting evaluation',  tone: 'info',    icon: Clock },
  evaluated:              { label: 'Evaluated',            tone: 'info',    icon: CheckCircle2 },
  result_published:      { label: 'Result published',     tone: 'success', icon: Award },
};

function SlotCell({ slot }: { slot: SlotReport }) {
  if (slot.status === 'empty') {
    return (
      <div className="flex items-center gap-1.5 text-[#9CA3AF]">
        <Ban size={12} />
        <span className="text-[11.5px]">Not uploaded</span>
      </div>
    );
  }

  const uploadBadge = slot.status === 'approved'
    ? <StatusBadge tone="success" icon={CheckCircle2}>Approved</StatusBadge>
    : slot.status === 'pending'
    ? <StatusBadge tone="warning" icon={Clock}>Pending</StatusBadge>
    : <StatusBadge tone="danger" icon={XCircle}>Rejected</StatusBadge>;

  const evalBadge = slot.status !== 'approved' ? null
    : slot.evaluationStatus === 'published'
    ? <StatusBadge tone="success" icon={Award}>{slot.percent}%</StatusBadge>
    : slot.evaluationStatus === 'evaluated'
    ? <StatusBadge tone="info" icon={CheckCircle2}>Scored</StatusBadge>
    : <StatusBadge tone="neutral" icon={Clock}>Not evaluated</StatusBadge>;

  return (
    <div className="flex flex-col gap-1 py-0.5">
      <div className="flex flex-wrap items-center gap-1">
        {uploadBadge}
        {evalBadge}
      </div>
      {slot.subCategory && (
        <p className="truncate text-[11px] text-[#6B7280]" title={slot.subCategory}>{slot.subCategory}</p>
      )}
      {slot.status === 'rejected' && slot.rejectionReason && (
        <p className="truncate text-[10.5px] text-[#B91C1C]" title={slot.rejectionReason}>{slot.rejectionReason}</p>
      )}
      {slot.status === 'approved' && (
        <div className="flex items-center gap-2 text-[10.5px] text-[#9CA3AF]">
          <span className="flex items-center gap-0.5"><Heart size={9} />{slot.likesCount}</span>
          <span className="flex items-center gap-0.5"><Eye size={9} />{slot.viewsCount}</span>
        </div>
      )}
    </div>
  );
}

export default function ReportsPage() {
  const [rows, setRows]         = useState<ReportRow[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [search, setSearch]     = useState('');
  const [classFilter, setClassFilter] = useState('ALL');
  const [verdictFilter, setVerdictFilter] = useState<'ALL' | Verdict>('ALL');

  const token = typeof window !== 'undefined' ? sessionStorage.getItem('schoolToken') || '' : '';

  useEffect(() => {
    fetch('/api/school/me/reports', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : r.json().then((e: any) => Promise.reject(e.message)))
      .then(setRows)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [token]);

  const classes = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows) if (r.classCode) map.set(r.classCode, r.className || r.classCode);
    return Array.from(map.entries()).map(([code, name]) => ({ code, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  const withVerdict = useMemo(() => rows.map(r => ({ ...r, verdict: rowVerdict(r) })), [rows]);

  const filtered = useMemo(() => {
    return withVerdict.filter(r => {
      if (classFilter !== 'ALL' && (r.classCode || '') !== classFilter) return false;
      if (verdictFilter !== 'ALL' && r.verdict !== verdictFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !r.name.toLowerCase().includes(q) &&
          !r.olympiadCode.toLowerCase().includes(q) &&
          !(r.username || '').toLowerCase().includes(q) &&
          !(r.phone || '').toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [withVerdict, classFilter, verdictFilter, search]);

  const totals = useMemo(() => {
    const total = rows.length;
    const registered = rows.filter(r => r.registrationStatus === 'registered').length;
    const bothUploaded = rows.filter(r => r.slotA.status !== 'empty' && r.slotB.status !== 'empty').length;
    const published = rows.filter(r => r.slotA.evaluationStatus === 'published' && r.slotB.evaluationStatus === 'published').length;
    const pendingEval = rows.filter(r => {
      const v = rowVerdict(r);
      return v === 'awaiting_evaluation' || v === 'evaluated';
    }).length;
    return { total, registered, bothUploaded, published, pendingEval };
  }, [rows]);

  const exportCSV = () => {
    const header = [
      'Name', 'Olympiad ID', 'Class', 'Username', 'Phone', 'Registration',
      `${OLYMPIAD_CAT_A_LABEL} status`, `${OLYMPIAD_CAT_A_LABEL} sub-category`, `${OLYMPIAD_CAT_A_LABEL} evaluation`, `${OLYMPIAD_CAT_A_LABEL} %`,
      `${OLYMPIAD_CAT_B_LABEL} status`, `${OLYMPIAD_CAT_B_LABEL} sub-category`, `${OLYMPIAD_CAT_B_LABEL} evaluation`, `${OLYMPIAD_CAT_B_LABEL} %`,
      'Overall status',
    ];
    const csvRows = filtered.map(r => [
      r.name, r.olympiadCode, r.className || '', r.username || '', r.phone || '', r.registrationStatus,
      r.slotA.status, r.slotA.subCategory || '', r.slotA.evaluationStatus, r.slotA.percent ?? '',
      r.slotB.status, r.slotB.subCategory || '', r.slotB.evaluationStatus, r.slotB.percent ?? '',
      VERDICT_META[r.verdict].label,
    ]);
    const csv = [header, ...csvRows].map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `student-report-${classFilter === 'ALL' ? 'all' : classFilter}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const verdictCounts = useMemo(() => {
    const map = new Map<Verdict, number>();
    for (const r of withVerdict) map.set(r.verdict, (map.get(r.verdict) || 0) + 1);
    return map;
  }, [withVerdict]);

  return (
    <div className={STACK}>

      <PageHeader
        icon={ClipboardList}
        title="Student Report"
        subtitle="Registration, uploads, and evaluation status for every allotted student"
        actions={
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-[#6B7280]">{filtered.length} of {rows.length} shown</span>
            <button onClick={exportCSV} disabled={filtered.length === 0} className={BTN_SUBTLE}>
              <Download size={13} /> Export CSV
            </button>
          </div>
        }
      />

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile label="Total allotted" value={totals.total} icon={Users} loading={loading} />
        <StatTile label="Registered" value={totals.registered} icon={UserCheck} loading={loading} />
        <StatTile label="Both videos in" value={totals.bothUploaded} icon={Video} loading={loading} />
        <StatTile label="Awaiting/under evaluation" value={totals.pendingEval} icon={Clock} loading={loading} />
        <StatTile label="Result published" value={totals.published} icon={Award} loading={loading} />
      </div>

      {/* Toolbar */}
      <div className={`${CARD} flex flex-wrap items-center gap-2 px-3 py-2.5`}>
        <div className="relative min-w-[200px] flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" size={13} />
          <input
            type="text"
            placeholder="Search name, ID, username, phone"
            aria-label="Search students"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className={`${INPUT} pl-8`}
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <FilterPill active={verdictFilter === 'ALL'} onClick={() => setVerdictFilter('ALL')}>All</FilterPill>
          {(Object.keys(VERDICT_META) as Verdict[])
            .filter(v => (verdictCounts.get(v) || 0) > 0)
            .map(v => (
              <FilterPill key={v} active={verdictFilter === v} onClick={() => setVerdictFilter(v)}>
                {VERDICT_META[v].label} ({verdictCounts.get(v) || 0})
              </FilterPill>
            ))}
        </div>

        {classes.length > 0 && (
          <div className="ml-auto flex items-center gap-1.5">
            <Filter size={13} className="text-[#9CA3AF]" />
            <select
              value={classFilter}
              onChange={e => setClassFilter(e.target.value)}
              aria-label="Filter by class"
              className={`${INPUT} !w-auto !py-1.5`}
            >
              <option value="ALL">All classes</option>
              {classes.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <LoadingState label="Building report…" />
      ) : error ? (
        <ErrorState message={error} />
      ) : filtered.length === 0 ? (
        <EmptyState icon={ClipboardList} title={rows.length === 0 ? 'No allotted students yet' : 'No students match your filters'} />
      ) : (
        <TableShell footer={<RowCount shown={filtered.length} total={rows.length} noun="students" />}>
          <table className={TABLE}>
            <thead>
              <tr>
                <th className={`${TH} sticky left-0 z-20 !bg-[#F3F5F8]`} style={{ minWidth: 200 }}>Student</th>
                <th className={TH}>Class</th>
                <th className={TH}>Registration</th>
                <th className={TH} style={{ minWidth: 190 }}>{getCategoryDisplayLabel(OLYMPIAD_CAT_A_LABEL)}</th>
                <th className={TH} style={{ minWidth: 190 }}>{getCategoryDisplayLabel(OLYMPIAD_CAT_B_LABEL)}</th>
                <th className={TH}>Overall status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => {
                const meta = VERDICT_META[r.verdict];
                const VIcon = meta.icon;
                return (
                  <tr key={r.key} className={TR}>
                    <td className={`${TD} sticky left-0 z-10 !bg-white`}>
                      <div className="flex items-center gap-2">
                        <Avatar name={r.name} tint={avatarTint(i)} size={26} />
                        <div className="min-w-0">
                          <p className="truncate text-[12.5px] font-semibold text-[#111827]">{r.name}</p>
                          <p className="truncate font-mono text-[11px] font-medium text-[#1559C7]">{r.olympiadCode}</p>
                        </div>
                      </div>
                    </td>
                    <td className={TD}>
                      {r.className ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-[#EDF0F4] px-1.5 py-0.5 text-[11px] font-medium text-[#4B5563]">
                          <BookOpen className="h-2.5 w-2.5" />{r.className}
                        </span>
                      ) : <span className="text-[#9CA3AF]">—</span>}
                    </td>
                    <td className={TD}>
                      {r.registrationStatus === 'registered' ? (
                        <StatusBadge tone="success" icon={UserCheck}>Registered</StatusBadge>
                      ) : (
                        <StatusBadge tone="neutral" icon={UserX}>Pending</StatusBadge>
                      )}
                      {r.source === 'app' && r.registrationStatus === 'registered' && (
                        <p className="mt-0.5 text-[10.5px] text-[#9CA3AF]">via app</p>
                      )}
                    </td>
                    <td className={TD}><SlotCell slot={r.slotA} /></td>
                    <td className={TD}><SlotCell slot={r.slotB} /></td>
                    <td className={TD}>
                      <StatusBadge tone={meta.tone} icon={VIcon}>{meta.label}</StatusBadge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableShell>
      )}
    </div>
  );
}
