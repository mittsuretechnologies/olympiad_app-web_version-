'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Clock3, CheckCircle2, XCircle, BarChart3, Play, School, User, Video } from 'lucide-react';
import { getCategoryDisplayLabel } from '@/lib/olympiad-categories';
import { STACK, CARD } from '../ui';
import {
  PageHeader, StatTile, StatusBadge, FilterPill, LoadingState, ErrorState, EmptyState, ModalShell,
} from '../components';

// Web version of the app's school "Status" tab (Olympiad_App/Components/
// components/SchoolStatusTab.js): every video the school uploaded — its own and
// those for a student — with its review status and, if rejected, the reason.

type Kind = 'SCHOOL' | 'STUDENT';

interface UploadedVideo {
  id: string;
  kind: Kind;
  videoUrl: string;
  thumbnailUrl: string | null;
  caption: string;
  category: string;
  subCategory: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectionReason: string | null;
  isEvaluation: boolean;
  createdAt: string;
  studentName: string | null;
  olympiadCode: string | null;
  className: string | null;
}

// Same labels as the app.
const STATUS_META = {
  PENDING:  { label: 'Under review', tone: 'warning' as const, icon: Clock3 },
  APPROVED: { label: 'Approved',     tone: 'success' as const, icon: CheckCircle2 },
  REJECTED: { label: 'Rejected',     tone: 'danger' as const,  icon: XCircle },
};

export default function UploadStatusPage() {
  const [videos, setVideos]   = useState<UploadedVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [kind, setKind]       = useState<'ALL' | Kind>('ALL');
  const [status, setStatus]   = useState<'ALL' | UploadedVideo['status']>('ALL');
  const [open, setOpen]       = useState<UploadedVideo | null>(null);

  const token = typeof window !== 'undefined' ? sessionStorage.getItem('schoolToken') || '' : '';

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/school/me/uploaded-videos?includeOwn=1', { headers: { Authorization: `Bearer ${token}` } })
      .then(async r => {
        const data = await r.json().catch(() => null);
        if (!r.ok) throw new Error(data?.message || 'Could not load the status.');
        setVideos(Array.isArray(data) ? data : []);
        setError('');
      })
      .catch(e => setError(e.message || 'Could not load the status.'))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const ofKind = useMemo(() => videos.filter(v => kind === 'ALL' || v.kind === kind), [videos, kind]);
  const shown = ofKind.filter(v => status === 'ALL' || v.status === status);
  const count = (st: UploadedVideo['status']) => ofKind.filter(v => v.status === st).length;
  const kindCount = (k: 'ALL' | Kind) => videos.filter(v => k === 'ALL' || v.kind === k).length;

  return (
    <div className={STACK}>
      <PageHeader
        icon={BarChart3}
        title="Upload Status"
        subtitle="Every video you uploaded, for your school or for a student, and where it is in review."
      />

      {/* Status counts double as a filter */}
      <div className="grid grid-cols-3 gap-2.5">
        {(Object.keys(STATUS_META) as UploadedVideo['status'][]).map(st => (
          <StatTile
            key={st}
            label={STATUS_META[st].label}
            value={count(st)}
            icon={STATUS_META[st].icon}
            loading={loading && videos.length === 0}
            active={status === st}
            onClick={() => setStatus(status === st ? 'ALL' : st)}
          />
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {([['ALL', 'All'], ['SCHOOL', 'School'], ['STUDENT', 'Student']] as const).map(([k, label]) => (
          <FilterPill key={k} active={kind === k} onClick={() => setKind(k)}>
            {label} <span className="tabular-nums opacity-70">{kindCount(k)}</span>
          </FilterPill>
        ))}
      </div>

      {loading && videos.length === 0 ? (
        <LoadingState />
      ) : error && videos.length === 0 ? (
        <div className="space-y-2">
          <ErrorState message={error} />
          <button type="button" onClick={load} className="text-[12.5px] font-semibold text-[#1559C7] hover:underline">Try again</button>
        </div>
      ) : shown.length === 0 ? (
        <EmptyState
          icon={BarChart3}
          title={videos.length === 0 ? 'No uploads yet' : 'Nothing here'}
          hint={videos.length === 0
            ? 'Videos you upload, for your school or for a student, are tracked here.'
            : 'No videos match this filter.'}
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {shown.map(v => {
            const meta = STATUS_META[v.status] ?? STATUS_META.PENDING;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => setOpen(v)}
                className={`${CARD} group overflow-hidden text-left transition-shadow hover:shadow-[0_4px_14px_rgba(15,27,45,0.10)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#1559C7]/25`}
              >
                <div className="relative aspect-[9/16] bg-[#0B1B33]">
                  {v.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={v.thumbnailUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-white/40"><Video className="h-7 w-7" /></div>
                  )}
                  <span className="absolute left-2 top-2"><StatusBadge tone={meta.tone} icon={meta.icon}>{meta.label}</StatusBadge></span>
                  <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-[3px] text-[10.5px] font-semibold text-white">
                    {v.kind === 'SCHOOL' ? <School className="h-3 w-3" /> : <User className="h-3 w-3" />}
                    {v.kind === 'SCHOOL' ? 'School' : 'Student'}
                  </span>
                  <span className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                    <span className="rounded-full bg-black/50 p-2.5"><Play className="h-5 w-5 text-white" /></span>
                  </span>
                </div>
                <div className="space-y-0.5 p-2.5">
                  <p className="truncate text-[12.5px] font-semibold text-[#0F1B2D]">
                    {v.kind === 'STUDENT' ? v.studentName : 'Your school'}
                  </p>
                  <p className="truncate text-[11.5px] text-[#677285]">
                    {v.subCategory || getCategoryDisplayLabel(v.category)}
                  </p>
                  {v.status === 'REJECTED' && v.rejectionReason && (
                    <p className="line-clamp-2 text-[11.5px] text-[#B42323]">{v.rejectionReason}</p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {open && (
        <ModalShell
          eyebrow={open.kind === 'SCHOOL' ? 'School video' : 'Student video'}
          title={open.kind === 'STUDENT' ? (open.studentName || 'Student') : 'Your school'}
          onClose={() => setOpen(null)}
          maxWidth="max-w-md"
        >
          <div className="space-y-3">
            <div className="overflow-hidden rounded-lg bg-[#0B1B33]">
              <video src={open.videoUrl} controls autoPlay className="max-h-[55vh] w-full object-contain" />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {(() => { const m = STATUS_META[open.status] ?? STATUS_META.PENDING; return <StatusBadge tone={m.tone} icon={m.icon}>{m.label}</StatusBadge>; })()}
              {open.isEvaluation && <StatusBadge tone="info">Olympiad</StatusBadge>}
            </div>
            {open.status === 'REJECTED' && (
              <div className="rounded-lg bg-[#B42323]/[0.08] px-3 py-2.5 text-[12.5px] text-[#B42323]">
                <p className="font-semibold">Reason</p>
                <p className="mt-0.5">{open.rejectionReason || 'No reason was given.'}</p>
              </div>
            )}
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[12.5px]">
              <dt className="text-[#677285]">Category</dt>
              <dd className="text-[#0F1B2D]">{getCategoryDisplayLabel(open.category)}{open.subCategory ? ` · ${open.subCategory}` : ''}</dd>
              {open.kind === 'STUDENT' && (
                <>
                  <dt className="text-[#677285]">Olympiad ID</dt>
                  <dd className="font-mono text-[#0F1B2D]">{open.olympiadCode || '-'}{open.className ? ` · ${open.className}` : ''}</dd>
                </>
              )}
              <dt className="text-[#677285]">Uploaded</dt>
              <dd className="text-[#0F1B2D]">{new Date(open.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</dd>
              {open.caption && (
                <>
                  <dt className="text-[#677285]">Caption</dt>
                  <dd className="whitespace-pre-line break-words text-[#0F1B2D]">{open.caption}</dd>
                </>
              )}
            </dl>
          </div>
        </ModalShell>
      )}
    </div>
  );
}
