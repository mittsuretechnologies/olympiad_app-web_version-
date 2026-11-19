'use client';

import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { fetcher, authFetch } from '@/lib/swr';
import {
  Smartphone, Loader2, Search, Download,
  Users, GraduationCap, Eye, Filter, X, Ban, ShieldCheck
} from 'lucide-react';

// Active right now: set, and either permanent or still in the future.
const isSuspendedNow = (u: { suspendedAt?: string | null; suspendedUntil?: string | null }) =>
  !!u.suspendedAt && (!u.suspendedUntil || new Date(u.suspendedUntil).getTime() > Date.now());

function isSuperAdmin(): boolean {
  try {
    const t = sessionStorage.getItem('token');
    if (!t) return false;
    const b64 = t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(b64)).role === 'SUPERADMIN';
  } catch { return false; }
}

interface AppUser {
  suspendedAt?: string | null;
  suspendedUntil?: string | null;
  suspensionType?: string | null;
  suspensionReason?: string | null;
  id: string;
  userId: string;
  email: string | null;
  mobile: string | null;
  olympiadId: string | null;
  isVerified: boolean;
  termsAccepted: boolean;
  accountType?: string;
  plainPassword: string | null;
  createdAt: string;
}

export default function AppUsersPage() {
  const { data, isLoading: loading, mutate } = useSWR<AppUser[]>('/api/app/users', fetcher);
  const users: AppUser[] = Array.isArray(data) ? data : [];

  // sessionStorage only exists in the browser, so read it after mount - doing
  // it during render makes the server HTML differ from the client (hydration error).
  const [canModerate, setCanModerate] = useState(false);
  useEffect(() => { setCanModerate(isSuperAdmin()); }, []);
  const [target, setTarget] = useState<AppUser | null>(null);
  const [mode, setMode] = useState<'suspend' | 'ban'>('suspend');
  const [days, setDays] = useState('7');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');

  const openAction = (u: AppUser) => {
    setTarget(u); setMode('suspend'); setDays('7'); setReason(''); setActionError('');
  };

  const submitAction = async (action: 'suspend' | 'ban' | 'reinstate') => {
    if (!target) return;
    setBusy(true); setActionError('');
    try {
      const res = await authFetch(`/api/dashboard/app-users/${target.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, days: Number(days), reason }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { setActionError(body.message || 'Failed'); return; }
      await mutate();
      setTarget(null);
    } finally {
      setBusy(false);
    }
  };

  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('All');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  const activeFilterCount = (filterRole !== 'All' ? 1 : 0)
    + (filterDateFrom ? 1 : 0) + (filterDateTo ? 1 : 0) + (search ? 1 : 0);

  const clearFilters = () => {
    setFilterRole('All'); setFilterDateFrom(''); setFilterDateTo(''); setSearch('');
  };

  const filtered = useMemo(() => {
    return users.filter(u => {
      if (filterRole === 'Student' && !u.olympiadId) return false;
      if (filterRole === 'Viewer' && (u.olympiadId || u.accountType === 'SCHOOL')) return false;
      if (filterRole === 'School' && u.accountType !== 'SCHOOL') return false;
      if (filterDateFrom && new Date(u.createdAt) < new Date(filterDateFrom)) return false;
      if (filterDateTo && new Date(u.createdAt) > new Date(filterDateTo + 'T23:59:59')) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !u.userId.toLowerCase().includes(q) &&
          !(u.email || '').toLowerCase().includes(q) &&
          !(u.mobile || '').includes(q) &&
          !(u.olympiadId || '').toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [users, filterRole, filterDateFrom, filterDateTo, search]);

  const studentCount = filtered.filter(u => u.olympiadId).length;
  const schoolCount = filtered.filter(u => u.accountType === 'SCHOOL').length;
  const viewerCount = filtered.filter(u => !u.olympiadId && u.accountType !== 'SCHOOL').length;

  const exportCSV = () => {
    if (filtered.length === 0) return;
    const headers = ['#', 'Username', 'Role', 'Email', 'Mobile', 'Olympiad ID', 'Registered On'];
    const rows = filtered.map((u, i) => [
      i + 1, u.userId,
      u.accountType === 'SCHOOL' ? 'School' : u.olympiadId ? 'Student' : 'Viewer',
      u.email || '-', u.mobile || '-',
      u.olympiadId || '-',
      new Date(u.createdAt).toLocaleDateString(),
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `app-users-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const sel = "h-9 border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:border-[#06013E] focus:ring-1 focus:ring-[#06013E] w-full";

  return (
    <div className="space-y-2">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium text-[#004f9f]">App Users Report</h1>
        </div>
        <button onClick={exportCSV} disabled={filtered.length === 0}
          className="inline-flex items-center gap-2 bg-[#06013E] text-white px-4 py-2.5 text-sm font-semibold hover:bg-[#09025c] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
          <Download size={14} /> Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <Filter size={14} className="text-gray-400" />
            Filters
            {activeFilterCount > 0 && <span className="bg-[#06013E] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{activeFilterCount}</span>}
          </div>
          {activeFilterCount > 0 && (
            <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors">
              <X size={12} /> Clear all
            </button>
          )}
        </div>
        <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Role</label>
            <select value={filterRole} onChange={e => setFilterRole(e.target.value)} className={sel}>
              <option>All</option><option>Student</option><option>Viewer</option><option>School</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">From</label>
            <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)}
              className="h-9 w-full border border-gray-200 px-3 text-sm focus:outline-none focus:border-[#06013E] focus:ring-1 focus:ring-[#06013E]" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">To</label>
            <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)}
              className="h-9 w-full border border-gray-200 px-3 text-sm focus:outline-none focus:border-[#06013E] focus:ring-1 focus:ring-[#06013E]" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Search</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
              <input type="text" placeholder="User ID / email / mobile..." value={search}
                onChange={e => setSearch(e.target.value)} autoComplete="off"
                className="h-9 w-full border border-gray-200 pl-8 pr-3 text-sm focus:outline-none focus:border-[#06013E] focus:ring-1 focus:ring-[#06013E]" />
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-stretch border border-gray-200 bg-white divide-x divide-gray-200">
        <div className="flex items-center gap-3 px-6 py-3">
          <Users size={17} className="text-[#004f9f]" />
          <span className="text-2xl font-bold text-[#004f9f]">{filtered.length}</span>
          <span className="text-sm text-gray-400">Total Users</span>
        </div>
        <div className="flex items-center gap-3 px-6 py-3">
          <GraduationCap size={17} className="text-amber-600" />
          <span className="text-2xl font-bold text-amber-700">{studentCount}</span>
          <span className="text-sm text-gray-400">Students</span>
        </div>
        <div className="flex items-center gap-3 px-6 py-3">
          <Eye size={17} className="text-blue-600" />
          <span className="text-2xl font-bold text-blue-700">{viewerCount}</span>
          <span className="text-sm text-gray-400">Viewers</span>
        </div>
        <div className="flex items-center gap-3 px-6 py-3">
          <span className="text-2xl font-bold text-green-700">{schoolCount}</span>
          <span className="text-sm text-gray-400">Schools</span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-600">
            <span className="text-[#004f9f]">{filtered.length}</span> users
          </p>
          {loading && <Loader2 size={14} className="animate-spin text-gray-400" />}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse min-w-[640px]">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-gray-500">
                <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider w-10">S.No</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider">Olympiad ID</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider">Username</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider">Role</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider">Email</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider">Mobile</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider">Registered On</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider">Status</th>
                {canModerate && <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider">Action</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="py-16 text-center">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto text-[#004f9f] mb-2" />
                  <p className="text-gray-400 text-sm">Loading...</p>
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="py-16 text-center text-gray-400 text-sm">
                  {users.length === 0 ? 'No app users yet.' : 'No records match your filters.'}
                </td></tr>
              ) : filtered.map((u, idx) => (
                <tr key={u.id} className={`border-b border-gray-100 hover:bg-blue-50/30 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}>
                  <td className="px-4 py-2.5 text-gray-400 text-xs">{idx + 1}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">
                    {u.olympiadId
                      ? <span className="font-semibold text-amber-700">{u.olympiadId}</span>
                      : <span className="text-gray-300">-</span>}
                  </td>
                  <td className="px-4 py-2.5 font-mono font-bold text-[#004f9f] text-sm">{u.userId}</td>
                  <td className="px-4 py-2.5">
                    {u.accountType === 'SCHOOL'
                      ? <span className="inline-flex items-center gap-1 text-[11px] font-bold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5">School</span>
                      : u.olympiadId
                      ? <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5"><GraduationCap size={10} />Student</span>
                      : <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5"><Eye size={10} />Viewer</span>
                    }
                  </td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs">{u.email || <span className="text-gray-300">-</span>}</td>
                  <td className="px-4 py-2.5 font-mono text-gray-500 text-xs">{u.mobile || <span className="text-gray-300">-</span>}</td>
                  <td className="px-4 py-2.5 text-gray-400 text-xs whitespace-nowrap">
                    {new Date(u.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-2.5 text-xs">
                    {isSuspendedNow(u)
                      ? <span title={u.suspensionReason || ''} className="inline-flex items-center gap-1 text-[11px] font-bold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5">
                          <Ban size={10} />
                          {u.suspendedUntil
                            ? `Suspended till ${new Date(u.suspendedUntil).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}`
                            : 'Banned'}
                        </span>
                      : <span className="text-green-700 font-semibold">Active</span>}
                  </td>
                  {canModerate && (
                    <td className="px-4 py-2.5">
                      <button onClick={() => openAction(u)}
                        className="text-xs font-semibold text-[#004f9f] hover:underline">
                        {isSuspendedNow(u) ? 'Reinstate' : 'Suspend / Ban'}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && users.length > 0 && (
          <div className="px-5 py-2.5 border-t border-gray-100 flex justify-between items-center text-xs text-gray-400">
            <span>Showing <span className="font-semibold text-gray-600">{filtered.length}</span> of <span className="font-semibold text-gray-600">{users.length}</span> users</span>
            <span className="italic">© mittmee</span>
          </div>
        )}
      </div>

      {/* Suspend / ban / reinstate dialog (Super Admin only) */}
      {target && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !busy && setTarget(null)}>
          <div className="w-full max-w-md bg-white border border-gray-200 p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[#004f9f]">
                  {isSuspendedNow(target) ? 'Reinstate account' : 'Suspend / Ban account'}
                </h2>
                <p className="text-sm text-gray-500 font-mono">{target.userId}</p>
              </div>
              <button onClick={() => setTarget(null)} disabled={busy} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
            </div>

            {isSuspendedNow(target) ? (
              <>
                <p className="text-sm text-gray-600">
                  {target.suspendedUntil
                    ? `Suspended until ${new Date(target.suspendedUntil).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}.`
                    : 'Permanently banned.'}
                  {target.suspensionReason ? ` Reason: ${target.suspensionReason}` : ''}
                </p>
                {actionError && <p className="text-sm text-red-600">{actionError}</p>}
                <button onClick={() => submitAction('reinstate')} disabled={busy}
                  className="w-full inline-flex items-center justify-center gap-2 bg-green-700 text-white px-4 py-2.5 text-sm font-semibold hover:bg-green-800 disabled:opacity-50">
                  {busy ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />} Reinstate account
                </button>
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2">
                  {(['suspend', 'ban'] as const).map(m => (
                    <button key={m} onClick={() => setMode(m)}
                      className={`px-3 py-2 text-sm font-semibold border ${mode === m ? 'bg-[#06013E] text-white border-[#06013E]' : 'bg-white text-gray-600 border-gray-200'}`}>
                      {m === 'suspend' ? 'Suspend (temporary)' : 'Ban (permanent)'}
                    </button>
                  ))}
                </div>
                {mode === 'suspend' && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Days (1-365)</label>
                    <input type="number" min={1} max={365} value={days} onChange={e => setDays(e.target.value)} className={sel} />
                  </div>
                )}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Reason (shown to the user)</label>
                  <textarea value={reason} onChange={e => setReason(e.target.value)} maxLength={500} rows={3}
                    className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[#06013E]" />
                </div>
                <p className="text-xs text-gray-500">
                  The user is logged out, cannot sign in, and their videos are hidden from every feed until reinstated.
                </p>
                {actionError && <p className="text-sm text-red-600">{actionError}</p>}
                <button onClick={() => submitAction(mode)} disabled={busy}
                  className="w-full inline-flex items-center justify-center gap-2 bg-red-700 text-white px-4 py-2.5 text-sm font-semibold hover:bg-red-800 disabled:opacity-50">
                  {busy ? <Loader2 size={14} className="animate-spin" /> : <Ban size={14} />}
                  {mode === 'suspend' ? `Suspend for ${days || '?'} day(s)` : 'Ban permanently'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

