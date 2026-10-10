'use client';

import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, Clock, Download, FileSignature,
  Loader2, Power, RefreshCw, RotateCcw, School, Search, ShieldCheck, Users, Video, X,
} from 'lucide-react';
import { authFetch } from '@/lib/swr';

/**
 * Superadmin - General Schools: schools that signed up in the mobile app on
 * their own (no Olympiad programme). Kept apart from the Olympiad `School`
 * pages on purpose. Shows each school's details, how many videos it has, and
 * whether it has accepted the School Onboarding Agreement. A school can be
 * switched off (login blocked, videos hidden) or asked to accept again.
 */

interface Agreement {
  accepted: boolean; acceptanceId: string | null; acceptedAt: string | null;
  ipAddress: string | null; channel: string | null; version: string;
  reacceptanceRequested?: { requestedAt: string; reason: string | null } | null;
}

interface Row {
  id: string; appUserId: string; username: string; name: string; email: string; mobile: string;
  contactPerson: string | null; state: string; district: string; city: string | null;
  pincode: string | null; address: string | null; isActive: boolean; isPrivate: boolean;
  deletionRequestedAt: string | null; lastLoginAt: string | null; createdAt: string;
  followers: number;
  videos: { total: number; approved: number; pending: number; rejected: number };
  agreement: Agreement;
}

interface ApiResponse {
  stats: { total: number; active: number; inactive: number; agreementPending: number };
  states: string[]; total: number; page: number; pageSize: number; schools: Row[];
}

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  }) : '-';

const csvCell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;

export default function GeneralSchoolsPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [status, setStatus] = useState<'loading' | 'error' | 'ok'>('loading');
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive' | 'agreement-pending'>('all');
  const [stateFilter, setStateFilter] = useState('');
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // One dialog for both actions (switch on/off, ask to accept the agreement again).
  const [action, setAction] = useState<{ kind: 'toggle' | 'reaccept'; row: Row } | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    debounceRef.current = setTimeout(() => { setDebouncedQ(q); setPage(1); }, 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [q]);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const params = new URLSearchParams({ status: filter, state: stateFilter, q: debouncedQ, page: String(page), pageSize: '25' });
      const res = await authFetch(`/api/dashboard/general-schools?${params}`);
      if (!res.ok) throw new Error();
      setData(await res.json());
      setStatus('ok');
    } catch {
      setStatus('error');
    }
  }, [filter, stateFilter, debouncedQ, page]);

  useEffect(() => { load(); }, [load]);

  const openAction = (kind: 'toggle' | 'reaccept', row: Row) => {
    setReason(''); setActionError(''); setAction({ kind, row });
  };

  const confirmAction = async () => {
    if (!action) return;
    setBusy(true); setActionError('');
    try {
      const { kind, row } = action;
      const res = kind === 'toggle'
        ? await authFetch(`/api/dashboard/general-schools/${row.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isActive: !row.isActive, reason }),
          })
        : await authFetch(`/api/dashboard/agreements/${row.agreement.acceptanceId}/request-reacceptance`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason }),
          });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || 'Action failed.');
      setAction(null);
      load();
    } catch (e: any) {
      setActionError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams({ status: filter, state: stateFilter, q: debouncedQ, all: '1' });
      const res = await authFetch(`/api/dashboard/general-schools?${params}`);
      if (!res.ok) throw new Error();
      const json: ApiResponse = await res.json();
      const head = ['School', 'Username', 'Contact person', 'Email', 'Mobile', 'State', 'District', 'City', 'Status',
        'Agreement accepted', 'Agreement accepted at', 'Videos', 'Approved', 'Pending', 'Rejected', 'Followers', 'Registered', 'Last login'];
      const lines = [head.map(csvCell).join(',')];
      for (const r of json.schools) {
        lines.push([
          r.name, r.username, r.contactPerson, r.email, r.mobile, r.state, r.district, r.city,
          r.isActive ? 'Active' : 'Inactive', r.agreement.accepted ? 'Yes' : 'No', fmt(r.agreement.acceptedAt),
          r.videos.total, r.videos.approved, r.videos.pending, r.videos.rejected, r.followers,
          fmt(r.createdAt), fmt(r.lastLoginAt),
        ].map(csvCell).join(','));
      }
      const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `general-schools-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const stats = data?.stats;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#009846]/10 text-[#009846]"><School size={22} /></div>
          <div>
            <h1 className="text-xl font-bold text-[#052E5C]">General Schools</h1>
            <p className="text-xs text-gray-500">Schools that registered themselves in the Mittmee app (not part of the Olympiad programme)</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50">
            <RefreshCw size={14} /> Refresh
          </button>
          <button onClick={exportCsv} disabled={exporting || !data?.total}
            className="flex items-center gap-1.5 rounded-lg bg-[#009846] px-3 py-2 text-xs font-semibold text-white hover:bg-[#007f3a] disabled:opacity-50">
            {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Export CSV
          </button>
        </div>
      </div>

      {/* Stat tiles - double as quick filters */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {([
          { key: 'all', label: 'Total schools', value: stats?.total, icon: Users, tone: 'text-[#052E5C]' },
          { key: 'active', label: 'Active', value: stats?.active, icon: CheckCircle2, tone: 'text-[#009846]' },
          { key: 'inactive', label: 'Switched off', value: stats?.inactive, icon: Power, tone: 'text-red-600' },
          { key: 'agreement-pending', label: 'Agreement pending', value: stats?.agreementPending, icon: Clock, tone: 'text-amber-600' },
        ] as const).map(t => (
          <button key={t.key} onClick={() => { setFilter(t.key); setPage(1); }}
            className={`rounded-xl border bg-white p-4 text-left transition hover:shadow-md ${filter === t.key ? 'border-[#009846] ring-1 ring-[#009846]' : 'border-gray-200'}`}>
            <div className={`flex items-center gap-2 text-xs font-semibold ${t.tone}`}><t.icon size={15} />{t.label}</div>
            <div className="mt-1 text-2xl font-bold text-[#052E5C] tabular-nums">{t.value ?? '-'}</div>
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white p-3">
        <div className="relative min-w-[220px] flex-1 max-w-md">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name, username, email, mobile, district"
            className="w-full rounded-lg border border-gray-200 py-2 pl-8 pr-3 text-sm outline-none focus:border-[#009846]" />
        </div>
        <select value={stateFilter} onChange={e => { setStateFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#009846]">
          <option value="">All states</option>
          {data?.states.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {(filter !== 'all' || stateFilter || q) && (
          <button onClick={() => { setFilter('all'); setStateFilter(''); setQ(''); setPage(1); }}
            className="flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-800"><X size={13} /> Clear</button>
        )}
        <span className="ml-auto text-xs tabular-nums text-gray-500">{data ? `${data.total} school${data.total === 1 ? '' : 's'}` : ''}</span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        {status === 'loading' && !data ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-500"><Loader2 className="animate-spin" size={16} /> Loading schools...</div>
        ) : status === 'error' ? (
          <div className="flex flex-col items-center gap-2 py-16 text-sm text-red-600"><AlertCircle size={18} /> Could not load schools.
            <button onClick={load} className="text-xs font-semibold underline">Try again</button></div>
        ) : !data || data.schools.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-500">No general schools found.</div>
        ) : (
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">School</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3 text-center">Videos</th>
                <th className="px-4 py-3">Agreement</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Registered</th>
              </tr>
            </thead>
            <tbody>
              {data.schools.map(r => {
                const open = expanded === r.id;
                return (
                  <Fragment key={r.id}>
                    <tr onClick={() => setExpanded(open ? null : r.id)} className="cursor-pointer border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-[#052E5C]">{r.name}</div>
                        <div className="text-xs text-gray-500">@{r.username}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{r.district}, {r.state}</td>
                      <td className="px-4 py-3 text-gray-700">
                        <div>{r.mobile}</div>
                        <div className="text-xs text-gray-500">{r.email}</div>
                      </td>
                      <td className="px-4 py-3 text-center tabular-nums">
                        <span className="font-semibold">{r.videos.total}</span>
                        {r.videos.pending > 0 && <span className="ml-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">{r.videos.pending} pending</span>}
                      </td>
                      <td className="px-4 py-3">
                        {r.agreement.accepted
                          ? <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-semibold text-green-700"><CheckCircle2 size={12} /> Accepted</span>
                          : <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700"><Clock size={12} /> {r.agreement.reacceptanceRequested ? 'Re-accept asked' : 'Pending'}</span>}
                      </td>
                      <td className="px-4 py-3">
                        {r.deletionRequestedAt
                          ? <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">Deletion requested</span>
                          : r.isActive
                            ? <span className="rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-semibold text-green-700">Active</span>
                            : <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-600">Switched off</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">{fmt(r.createdAt)}</td>
                    </tr>
                    {open && (
                      <tr className="border-t border-gray-100 bg-gray-50/60">
                        <td colSpan={7} className="px-5 py-4">
                          <div className="grid gap-5 md:grid-cols-3">
                            <div className="space-y-1 text-xs text-gray-700">
                              <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-gray-500"><School size={13} /> School details</div>
                              <div><b>Contact person:</b> {r.contactPerson || '-'}</div>
                              <div><b>Address:</b> {[r.address, r.city, r.district, r.state, r.pincode].filter(Boolean).join(', ')}</div>
                              <div><b>Account:</b> {r.isPrivate ? 'Private' : 'Public'} / {r.followers} follower{r.followers === 1 ? '' : 's'}</div>
                              <div><b>Last login:</b> {fmt(r.lastLoginAt)}</div>
                            </div>
                            <div className="space-y-1 text-xs text-gray-700">
                              <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-gray-500"><Video size={13} /> Videos</div>
                              <div><b>Total:</b> {r.videos.total}</div>
                              <div><b>Approved:</b> {r.videos.approved}</div>
                              <div><b>Pending review:</b> {r.videos.pending}</div>
                              <div><b>Rejected:</b> {r.videos.rejected}</div>
                            </div>
                            <div className="space-y-1 text-xs text-gray-700">
                              <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-gray-500"><FileSignature size={13} /> Agreement (v{r.agreement.version})</div>
                              {r.agreement.accepted ? (
                                <>
                                  <div><b>Accepted:</b> {fmt(r.agreement.acceptedAt)}</div>
                                  <div><b>Verified by:</b> {r.agreement.channel === 'SMS_OTP' ? 'Mobile OTP at sign-up' : r.agreement.channel}</div>
                                  <div><b>IP address:</b> {r.agreement.ipAddress || '-'}</div>
                                </>
                              ) : (
                                <div className="text-amber-700">
                                  Not accepted yet.
                                  {r.agreement.reacceptanceRequested && <> Re-acceptance asked on {fmt(r.agreement.reacceptanceRequested.requestedAt)}{r.agreement.reacceptanceRequested.reason ? ` (${r.agreement.reacceptanceRequested.reason})` : ''}.</>}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="mt-4 flex flex-wrap gap-2">
                            <button onClick={e => { e.stopPropagation(); openAction('toggle', r); }}
                              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white ${r.isActive ? 'bg-red-600 hover:bg-red-700' : 'bg-[#009846] hover:bg-[#007f3a]'}`}>
                              <Power size={13} /> {r.isActive ? 'Switch off school' : 'Switch school on'}
                            </button>
                            {r.agreement.accepted && r.agreement.acceptanceId && (
                              <button onClick={e => { e.stopPropagation(); openAction('reaccept', r); }}
                                className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50">
                                <RotateCcw size={13} /> Ask to accept agreement again
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {data && data.total > data.pageSize && (
        <div className="flex items-center justify-end gap-2 text-xs text-gray-600">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="rounded-lg border border-gray-200 bg-white p-2 disabled:opacity-40"><ChevronLeft size={14} /></button>
          <span className="tabular-nums">Page {page} of {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="rounded-lg border border-gray-200 bg-white p-2 disabled:opacity-40"><ChevronRight size={14} /></button>
        </div>
      )}

      {/* Action dialog */}
      {action && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !busy && setAction(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="mb-2 flex items-center gap-2 text-base font-bold text-[#052E5C]">
              {action.kind === 'toggle' ? <Power size={18} /> : <ShieldCheck size={18} />}
              {action.kind === 'toggle'
                ? (action.row.isActive ? 'Switch off this school?' : 'Switch this school on?')
                : 'Ask this school to accept again?'}
            </div>
            <p className="mb-3 text-sm text-gray-600">
              {action.kind === 'toggle'
                ? (action.row.isActive
                    ? <>{action.row.name} will be logged out and will not be able to log in. Its videos will be hidden from every feed and search until you switch it back on.</>
                    : <>{action.row.name} will be able to log in again and its videos will show again.</>)
                : <>The school will see the agreement the next time it opens the app and must accept it again. The earlier acceptance is kept as evidence.</>}
            </p>
            <label className="mb-1 block text-xs font-semibold text-gray-600">Reason (optional, saved in the activity log)</label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} maxLength={500}
              className="w-full rounded-lg border border-gray-200 p-2 text-sm outline-none focus:border-[#009846]" />
            {actionError && <p className="mt-2 flex items-center gap-1 text-xs text-red-600"><AlertCircle size={13} /> {actionError}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button disabled={busy} onClick={() => setAction(null)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancel</button>
              <button disabled={busy} onClick={confirmAction}
                className="flex items-center gap-1.5 rounded-lg bg-[#009846] px-4 py-2 text-sm font-semibold text-white hover:bg-[#007f3a] disabled:opacity-60">
                {busy && <Loader2 size={14} className="animate-spin" />} Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
