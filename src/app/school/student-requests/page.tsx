'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import {
  UserCheck, Loader2, Search, Check, X, Clock, Ban, Video as VideoIcon,
  Mail, Phone, Calendar, Trash2, AlertCircle, ChevronDown, ChevronUp, Lock,
} from 'lucide-react';
import { CARD, STACK, TABLE, TH, TD, TR, INPUT, BTN_PRIMARY, BTN_SECONDARY, avatarTint } from '../ui';
import {
  PageHeader, StatTile, StatusBadge, FilterPill, Avatar,
  LoadingState, ErrorState, EmptyState, ModalShell, TableShell, RowCount,
} from '../components';

interface PreviewVideo {
  id: string;
  thumbnailUrl: string | null;
  videoUrl: string;
  caption: string | null;
  createdAt: string;
}

interface LinkRequest {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  decidedAt: string | null;
  appUserId: string;
  username: string;
  email: string | null;
  mobile: string | null;
  avatarUrl: string | null;
  isPrivate: boolean;
  joinedAt: string;
  videoCount: number;
  previewVideos: PreviewVideo[];
}

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

/** Expandable panel under a row: contact details and a look at the videos that
 *  would surface on this portal once the student is approved. Approving on the
 *  strength of a username alone is a guess, so the evidence lives one click
 *  away rather than on another page. */
function RequestDetail({ r }: { r: LinkRequest }) {
  return (
    <div className="grid grid-cols-1 gap-3 bg-[#FAFBFC] p-4 sm:grid-cols-2">
      <div className="rounded-lg border border-[#C9E9DA] bg-[#E9F7F0] p-3.5">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">Contact</p>
        <dl className="space-y-1.5 text-[12.5px]">
          <div className="flex items-center gap-2">
            <Phone size={12} className="flex-shrink-0 text-[#9CA3AF]" />
            <span className="font-mono text-black">{r.mobile || '—'}</span>
          </div>
          {r.email && (
            <div className="flex items-center gap-2">
              <Mail size={12} className="flex-shrink-0 text-[#9CA3AF]" />
              <span className="truncate text-black">{r.email}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Calendar size={12} className="flex-shrink-0 text-[#9CA3AF]" />
            <span className="text-black">On Mittmee since {fmtDate(r.joinedAt)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock size={12} className="flex-shrink-0 text-[#9CA3AF]" />
            <span className="text-black">Requested {fmtDate(r.createdAt)}</span>
          </div>
        </dl>
      </div>

      <div className="rounded-lg border border-[#E1DAF7] bg-[#F1EEFB] p-3.5">
        <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">
          <VideoIcon size={11} /> Recent videos ({r.videoCount})
        </p>
        {r.previewVideos.length === 0 ? (
          <p className="text-[12.5px] text-[#6B7280]">This student has no approved videos yet.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {r.previewVideos.map(v => (
              <a
                key={v.id}
                href={v.videoUrl}
                target="_blank"
                rel="noreferrer"
                title={v.caption || 'Open video'}
                className="group relative block aspect-[9/16] overflow-hidden rounded-md bg-[#DCD6F2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C6FCB]/40"
              >
                {v.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={v.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center">
                    <VideoIcon size={14} className="text-[#7C6FCB]" />
                  </span>
                )}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SchoolStudentRequestsPage() {
  const [requests, setRequests] = useState<LinkRequest[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [search, setSearch]     = useState('');
  const [filter, setFilter]     = useState<'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL'>('PENDING');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busyId, setBusyId]     = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  // Removing a linked student is not undoable from here, so it is confirmed.
  const [removeTarget, setRemoveTarget] = useState<LinkRequest | null>(null);

  const token = typeof window !== 'undefined' ? sessionStorage.getItem('schoolToken') || '' : '';

  const load = () => {
    fetch('/api/school/me/student-requests', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => (r.ok ? r.json() : r.json().then((e: any) => Promise.reject(e.message || 'Failed to load'))))
      .then(setRequests)
      .catch(m => setError(String(m)))
      .finally(() => setLoading(false));
  };

  useEffect(load, [token]);

  const decide = async (r: LinkRequest, action: 'APPROVE' | 'REJECT') => {
    setBusyId(r.id);
    setActionError('');
    try {
      const res = await fetch(`/api/school/me/student-requests/${r.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to update request');
      setRequests(prev => prev.map(x =>
        x.id === r.id ? { ...x, status: data.status, decidedAt: new Date().toISOString() } : x,
      ));
    } catch (e: any) {
      setActionError(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (r: LinkRequest) => {
    setBusyId(r.id);
    setActionError('');
    try {
      const res = await fetch(`/api/school/me/student-requests/${r.id}`, {
        method:  'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to remove student');
      setRequests(prev => prev.filter(x => x.id !== r.id));
      setRemoveTarget(null);
    } catch (e: any) {
      setActionError(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const counts = useMemo(() => ({
    pending:  requests.filter(r => r.status === 'PENDING').length,
    approved: requests.filter(r => r.status === 'APPROVED').length,
    rejected: requests.filter(r => r.status === 'REJECTED').length,
  }), [requests]);

  const filtered = useMemo(() => requests.filter(r => {
    if (filter !== 'ALL' && r.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (
        !r.username.toLowerCase().includes(q) &&
        !(r.email || '').toLowerCase().includes(q) &&
        !(r.mobile || '').includes(q)
      ) return false;
    }
    return true;
  }), [requests, filter, search]);

  if (loading) return <LoadingState label="Loading student requests…" />;
  if (error)   return <ErrorState message={error} />;

  return (
    <div className={STACK}>
      <PageHeader
        icon={UserCheck}
        title="Student Requests"
        subtitle="App users asking to be confirmed as your students"
      />

      {/* What approving actually does — stated once, where the decision is made,
          so nobody has to guess whether this grants Olympiad entry. */}
      <div className="flex items-start gap-2.5 rounded-lg border border-[#BFD8F5] bg-[#EDF4FD] p-3 text-[12.5px] text-[#1F3B63]">
        <AlertCircle size={14} className="mt-0.5 flex-shrink-0 text-[#1559C7]" />
        <p>
          Mittmee app users without an Olympiad ID, requesting to be linked to your school.
          Approving only shows their videos on your Student Videos and school page — it does
          not grant an Olympiad ID or entry.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile label="Awaiting your decision" value={counts.pending}  icon={Clock}     active={filter === 'PENDING'}  onClick={() => setFilter('PENDING')} />
        <StatTile label="Linked students"        value={counts.approved} icon={UserCheck} active={filter === 'APPROVED'} onClick={() => setFilter('APPROVED')} />
        <StatTile label="Declined"               value={counts.rejected} icon={Ban}       active={filter === 'REJECTED'} onClick={() => setFilter('REJECTED')} />
      </div>

      <div className={`${CARD} flex flex-wrap items-center gap-2 p-3`}>
        <div className="relative min-w-[200px] flex-1">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by username, email or mobile"
            className={`${INPUT} pl-8`}
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <FilterPill active={filter === 'PENDING'}  onClick={() => setFilter('PENDING')}>Pending</FilterPill>
          <FilterPill active={filter === 'APPROVED'} onClick={() => setFilter('APPROVED')}>Linked</FilterPill>
          <FilterPill active={filter === 'REJECTED'} onClick={() => setFilter('REJECTED')}>Declined</FilterPill>
          <FilterPill active={filter === 'ALL'}      onClick={() => setFilter('ALL')}>All</FilterPill>
        </div>
      </div>

      {actionError && (
        <div className="flex items-center gap-2 rounded-lg border border-[#F3C6C6] bg-[#FCEDED] p-3 text-[12.5px] text-[#B91C1C]">
          <AlertCircle size={14} className="flex-shrink-0" /> {actionError}
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          icon={UserCheck}
          title={filter === 'PENDING' ? 'No requests waiting' : 'Nothing here'}
          hint={
            filter === 'PENDING'
              ? 'When a student without an Olympiad ID picks your school in the Mittmee app, their request appears here.'
              : 'Try a different filter.'
          }
        />
      ) : (
        <TableShell footer={<RowCount shown={filtered.length} total={requests.length} noun="requests" />}>
          <table className={TABLE}>
            <thead>
              <tr>
                <th className={TH}>Student</th>
                <th className={TH}>Contact</th>
                <th className={TH}>Videos</th>
                <th className={TH}>Requested</th>
                <th className={TH}>Status</th>
                <th className={`${TH} text-right`}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => {
                const open = expandedId === r.id;
                const busy = busyId === r.id;
                return (
                  <Fragment key={r.id}>
                    <tr className={TR}>
                      <td className={TD}>
                        <button
                          onClick={() => setExpandedId(open ? null : r.id)}
                          className="flex cursor-pointer items-center gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1559C7]/40"
                          aria-expanded={open}
                        >
                          <Avatar name={r.username} tint={avatarTint(i)} />
                          <span className="min-w-0">
                            <span className="flex items-center gap-1.5 font-semibold text-[#0E2A5C]">
                              {r.username}
                              {r.isPrivate && <Lock size={10} className="text-[#9CA3AF]" aria-label="Private account" />}
                            </span>
                            <span className="block text-[11.5px] text-[#6B7280]">No Olympiad ID</span>
                          </span>
                          {open ? <ChevronUp size={13} className="text-[#9CA3AF]" /> : <ChevronDown size={13} className="text-[#9CA3AF]" />}
                        </button>
                      </td>
                      <td className={TD}>
                        <span className="font-mono text-[12px]">{r.mobile || '—'}</span>
                      </td>
                      <td className={TD}>{r.videoCount}</td>
                      <td className={TD}>{fmtDate(r.createdAt)}</td>
                      <td className={TD}>
                        {r.status === 'PENDING'  && <StatusBadge tone="warning" icon={Clock}>Pending</StatusBadge>}
                        {r.status === 'APPROVED' && <StatusBadge tone="success" icon={Check}>Linked</StatusBadge>}
                        {r.status === 'REJECTED' && <StatusBadge tone="danger"  icon={Ban}>Declined</StatusBadge>}
                      </td>
                      <td className={`${TD} text-right`}>
                        {busy ? (
                          <Loader2 size={14} className="ml-auto animate-spin text-[#9CA3AF]" />
                        ) : r.status === 'PENDING' ? (
                          <span className="flex justify-end gap-1.5">
                            <button onClick={() => decide(r, 'APPROVE')} className={`${BTN_PRIMARY} px-2.5 py-1 text-[12px]`}>
                              <Check size={12} /> Approve
                            </button>
                            <button onClick={() => decide(r, 'REJECT')} className={`${BTN_SECONDARY} px-2.5 py-1 text-[12px]`}>
                              <X size={12} /> Decline
                            </button>
                          </span>
                        ) : (
                          <button
                            onClick={() => setRemoveTarget(r)}
                            className={`${BTN_SECONDARY} px-2.5 py-1 text-[12px]`}
                          >
                            <Trash2 size={12} /> {r.status === 'APPROVED' ? 'Remove' : 'Clear'}
                          </button>
                        )}
                      </td>
                    </tr>
                    {open && (
                      <tr>
                        <td colSpan={6} className="border border-[#E4E8EE] p-0">
                          <RequestDetail r={r} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </TableShell>
      )}

      {removeTarget && (
        <ModalShell
          eyebrow="Student link"
          title={removeTarget.status === 'APPROVED' ? 'Remove this student?' : 'Clear this request?'}
          onClose={() => setRemoveTarget(null)}
        >
          <div className="space-y-3">
            <p className="text-[13px] text-[#374151]">
              {removeTarget.status === 'APPROVED' ? (
                <>
                  <span className="font-semibold text-[#0E2A5C]">{removeTarget.username}</span> will
                  no longer be linked to your school, and their {removeTarget.videoCount} video
                  {removeTarget.videoCount === 1 ? '' : 's'} will stop appearing on your portal and
                  your school page in the app. Their videos are not deleted, and they can send a new
                  request later.
                </>
              ) : (
                <>
                  This clears the declined request from your list.{' '}
                  <span className="font-semibold text-[#0E2A5C]">{removeTarget.username}</span> can
                  ask again after that.
                </>
              )}
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setRemoveTarget(null)} className={BTN_SECONDARY}>Cancel</button>
              <button
                onClick={() => remove(removeTarget)}
                disabled={busyId === removeTarget.id}
                className={BTN_PRIMARY}
              >
                {busyId === removeTarget.id && <Loader2 size={13} className="animate-spin" />}
                {removeTarget.status === 'APPROVED' ? 'Remove student' : 'Clear'}
              </button>
            </div>
          </div>
        </ModalShell>
      )}
    </div>
  );
}
