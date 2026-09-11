'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/swr';
import {
  Clock, Loader2, Search, Download, Users, GraduationCap,
  Smartphone, Filter, X, School,
} from 'lucide-react';

interface ActivityRow {
  id: string;
  type: 'STUDENT' | 'APP_USER';
  // Olympiad = enrolled through a school (a Student row, or an AppUser that
  // carries an olympiadId). General = signed up on the app independently.
  accountKind: 'OLYMPIAD' | 'GENERAL';
  name: string;
  identifier: string | null;
  contact: string | null;
  schoolName: string | null;
  city: string | null;
  state: string | null;
  lastLoginAt: string | null;
  createdAt: string;
}

// "2 hours ago" / "5 days ago" style relative label — the whole point of this
// page is scanning who's been active recently, and an absolute timestamp
// alone makes that a mental-math exercise for every row.
function relativeTime(iso: string | null): string {
  if (!iso) return 'Never';
  const then = new Date(iso).getTime();
  const diffMs = Date.now() - then;
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

// Exact date + time, shown under the relative label. The relative form is
// what makes the list scannable, but "5d ago" is useless for the actual
// question this report gets used for — when precisely was this account last
// active — so both are shown rather than one replacing the other.
function absoluteTime(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

// Active in the last 24h reads as a distinct "currently engaged" signal from
// the rest of the list, which is otherwise sorted but visually uniform.
function isRecentlyActive(iso: string | null): boolean {
  if (!iso) return false;
  return Date.now() - new Date(iso).getTime() < 24 * 60 * 60 * 1000;
}

export default function StudentActivityPage() {
  const { data, isLoading: loading } = useSWR<ActivityRow[]>('/api/dashboard/student-activity', fetcher);
  const rows: ActivityRow[] = Array.isArray(data) ? data : [];

  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('All');
  const [filterActivity, setFilterActivity] = useState('All');

  const activeFilterCount = (filterType !== 'All' ? 1 : 0) + (filterActivity !== 'All' ? 1 : 0) + (search ? 1 : 0);

  const clearFilters = () => {
    setFilterType('All'); setFilterActivity('All'); setSearch('');
  };

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (filterType === 'Olympiad User' && r.accountKind !== 'OLYMPIAD') return false;
      if (filterType === 'General User'  && r.accountKind !== 'GENERAL')  return false;
      if (filterActivity === 'Active (24h)' && !isRecentlyActive(r.lastLoginAt)) return false;
      if (filterActivity === 'Never logged in' && r.lastLoginAt) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !r.name.toLowerCase().includes(q) &&
          !(r.identifier || '').toLowerCase().includes(q) &&
          !(r.contact || '').includes(q) &&
          !(r.schoolName || '').toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [rows, filterType, filterActivity, search]);

  const olympiadCount = filtered.filter(r => r.accountKind === 'OLYMPIAD').length;
  const generalCount  = filtered.filter(r => r.accountKind === 'GENERAL').length;
  const activeNowCount = filtered.filter(r => isRecentlyActive(r.lastLoginAt)).length;

  const exportCSV = () => {
    if (filtered.length === 0) return;
    const headers = ['#', 'Name', 'Account Type', 'Source', 'Identifier', 'Contact', 'School', 'Last Active', 'Registered On'];
    const csvRows = filtered.map((r, i) => [
      i + 1, r.name,
      r.accountKind === 'OLYMPIAD' ? 'Olympiad User' : 'General User',
      r.type === 'STUDENT' ? 'Student' : 'App User',
      r.identifier || '-', r.contact || '-', r.schoolName || '-',
      absoluteTime(r.lastLoginAt) ?? 'Never',
      new Date(r.createdAt).toLocaleDateString(),
    ]);
    const csv = [headers, ...csvRows].map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `student-activity-${new Date().toISOString().split('T')[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const sel = "h-9 border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:border-[#06013E] focus:ring-1 focus:ring-[#06013E] w-full";

  return (
    <div className="space-y-2">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium text-[#004f9f]">Student Activity</h1>
          <p className="text-xs text-gray-400 mt-0.5">Last-active time across Olympiad and General user accounts</p>
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
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Account Type</label>
            <select value={filterType} onChange={e => setFilterType(e.target.value)} className={sel}>
              <option>All</option><option>Olympiad User</option><option>General User</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Activity</label>
            <select value={filterActivity} onChange={e => setFilterActivity(e.target.value)} className={sel}>
              <option>All</option><option>Active (24h)</option><option>Never logged in</option>
            </select>
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Search</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
              <input type="text" placeholder="Name / ID / mobile / school..." value={search}
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
          <span className="text-sm text-gray-400">Total</span>
        </div>
        <div className="flex items-center gap-3 px-6 py-3">
          <GraduationCap size={17} className="text-amber-600" />
          <span className="text-2xl font-bold text-amber-700">{olympiadCount}</span>
          <span className="text-sm text-gray-400">Olympiad Users</span>
        </div>
        <div className="flex items-center gap-3 px-6 py-3">
          <Smartphone size={17} className="text-blue-600" />
          <span className="text-2xl font-bold text-blue-700">{generalCount}</span>
          <span className="text-sm text-gray-400">General Users</span>
        </div>
        <div className="flex items-center gap-3 px-6 py-3">
          <Clock size={17} className="text-green-600" />
          <span className="text-2xl font-bold text-green-700">{activeNowCount}</span>
          <span className="text-sm text-gray-400">Active (24h)</span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-600">
            <span className="text-[#004f9f]">{filtered.length}</span> accounts
          </p>
          {loading && <Loader2 size={14} className="animate-spin text-gray-400" />}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse min-w-[760px]">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-gray-500">
                <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider w-10">S.No</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider">Type</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider">Name</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider">Identifier</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider">School</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider">Contact</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider">Last Active</th>
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
                  {rows.length === 0 ? 'No student activity yet.' : 'No records match your filters.'}
                </td></tr>
              ) : filtered.map((r, idx) => {
                const recent = isRecentlyActive(r.lastLoginAt);
                return (
                  <tr key={`${r.type}-${r.id}`} className={`border-b border-gray-100 hover:bg-blue-50/30 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}>
                    <td className="px-4 py-2.5 text-gray-400 text-xs">{idx + 1}</td>
                    <td className="px-4 py-2.5">
                      {r.accountKind === 'OLYMPIAD'
                        ? <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5"><GraduationCap size={10} />Olympiad</span>
                        : <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5"><Smartphone size={10} />General</span>
                      }
                      {/* An Olympiad account exists twice over: the school's
                          Student record and the student's own app login. The
                          sub-label keeps those distinguishable now that the
                          main badge shows Olympiad/General instead. */}
                      <span className="block mt-0.5 text-[10px] text-gray-400">
                        {r.type === 'STUDENT' ? 'Student' : 'App User'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-semibold text-gray-800 text-sm">{r.name}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">
                      {r.identifier
                        ? <span className="font-semibold text-[#004f9f]">{r.identifier}</span>
                        : <span className="text-gray-300">-</span>}
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs">
                      {r.schoolName
                        ? <span className="inline-flex items-center gap-1"><School size={11} className="text-gray-400" />{r.schoolName}</span>
                        : <span className="text-gray-300">-</span>}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-gray-500 text-xs">{r.contact || <span className="text-gray-300">-</span>}</td>
                    <td className="px-4 py-2.5 text-xs whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1.5 font-semibold ${recent ? 'text-green-700' : r.lastLoginAt ? 'text-gray-500' : 'text-gray-300 italic'}`}>
                        {recent && <span className="w-1.5 h-1.5 rounded-full bg-green-500" />}
                        {relativeTime(r.lastLoginAt)}
                      </span>
                      {/* Exact timestamp under the relative one — "5d ago" is
                          good for scanning, useless for answering when. */}
                      {r.lastLoginAt && (
                        <span className="block mt-0.5 text-[10px] text-gray-400 font-normal">
                          {absoluteTime(r.lastLoginAt)}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!loading && rows.length > 0 && (
          <div className="px-5 py-2.5 border-t border-gray-100 flex justify-between items-center text-xs text-gray-400">
            <span>Showing <span className="font-semibold text-gray-600">{filtered.length}</span> of <span className="font-semibold text-gray-600">{rows.length}</span> accounts</span>
            <span className="italic">© mittmee</span>
          </div>
        )}
      </div>
    </div>
  );
}
