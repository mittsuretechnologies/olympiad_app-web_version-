'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/swr';
import {
  Smartphone, Loader2, Search, Download,
  Users, GraduationCap, Eye, Filter, X
} from 'lucide-react';

interface AppUser {
  id: string;
  userId: string;
  email: string | null;
  mobile: string | null;
  olympiadId: string | null;
  isVerified: boolean;
  termsAccepted: boolean;
  plainPassword: string | null;
  createdAt: string;
}

export default function AppUsersPage() {
  const { data, isLoading: loading } = useSWR<AppUser[]>('/api/app/users', fetcher);
  const users: AppUser[] = Array.isArray(data) ? data : [];

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
      if (filterRole === 'Viewer' && u.olympiadId) return false;
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
  const viewerCount = filtered.filter(u => !u.olympiadId).length;

  const exportCSV = () => {
    if (filtered.length === 0) return;
    const headers = ['#', 'Username', 'Role', 'Email', 'Mobile', 'Olympiad ID', 'Registered On'];
    const rows = filtered.map((u, i) => [
      i + 1, u.userId,
      u.olympiadId ? 'Student' : 'Viewer',
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
        <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Role</label>
            <select value={filterRole} onChange={e => setFilterRole(e.target.value)} className={sel}>
              <option>All</option><option>Student</option><option>Viewer</option>
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
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-gray-500">
                <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider w-10">S.No</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider">Olympiad ID</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider">Username</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider">Role</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider">Email</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider">Mobile</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider">Registered On</th>
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
                    {u.olympiadId
                      ? <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5"><GraduationCap size={10} />Student</span>
                      : <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5"><Eye size={10} />Viewer</span>
                    }
                  </td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs">{u.email || <span className="text-gray-300">-</span>}</td>
                  <td className="px-4 py-2.5 font-mono text-gray-500 text-xs">{u.mobile || <span className="text-gray-300">-</span>}</td>
                  <td className="px-4 py-2.5 text-gray-400 text-xs whitespace-nowrap">
                    {new Date(u.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && users.length > 0 && (
          <div className="px-5 py-2.5 border-t border-gray-100 flex justify-between items-center text-xs text-gray-400">
            <span>Showing <span className="font-semibold text-gray-600">{filtered.length}</span> of <span className="font-semibold text-gray-600">{users.length}</span> users</span>
            <span className="italic">Â© Mittsure Olympiad Portal</span>
          </div>
        )}
      </div>
    </div>
  );
}

