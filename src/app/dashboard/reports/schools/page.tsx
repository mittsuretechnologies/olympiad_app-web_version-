'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/swr';
import {
  School, Loader2, Search, Download,
  Building2, Users, CheckCircle2, Clock3, Filter, X, TrendingUp
} from 'lucide-react';

interface SchoolReport {
  id: string;
  schoolId: string;
  name: string;
  city: string | null;
  state: string | null;
  district: string | null;
  olympiadId: string | null;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  createdAt: string;
  allocated: number;
  registered: number;
  verified: number;
}

export default function SchoolReportPage() {
  const { data, isLoading: loading } = useSWR<SchoolReport[]>('/api/reports/schools', fetcher);
  const rows: SchoolReport[] = Array.isArray(data) ? data : [];

  const [search, setSearch] = useState('');
  const [filterState, setFilterState] = useState('All');
  const [filterDistrict, setFilterDistrict] = useState('All');
  const [filterCity, setFilterCity] = useState('All');

  const states = useMemo(() => ['All', ...Array.from(new Set(rows.map(r => r.state).filter(Boolean) as string[])).sort()], [rows]);
  const districts = useMemo(() => {
    const base = rows.filter(r => filterState === 'All' || r.state === filterState);
    return ['All', ...Array.from(new Set(base.map(r => r.district).filter(Boolean) as string[])).sort()];
  }, [rows, filterState]);
  const cities = useMemo(() => {
    const base = rows.filter(r =>
      (filterState === 'All' || r.state === filterState) &&
      (filterDistrict === 'All' || r.district === filterDistrict)
    );
    return ['All', ...Array.from(new Set(base.map(r => r.city).filter(Boolean) as string[])).sort()];
  }, [rows, filterState, filterDistrict]);

  const activeFilterCount = [filterState, filterDistrict, filterCity].filter(v => v !== 'All').length + (search ? 1 : 0);

  const clearFilters = () => { setFilterState('All'); setFilterDistrict('All'); setFilterCity('All'); setSearch(''); };

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (filterState !== 'All' && r.state !== filterState) return false;
      if (filterDistrict !== 'All' && r.district !== filterDistrict) return false;
      if (filterCity !== 'All' && r.city !== filterCity) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!r.name.toLowerCase().includes(q) && !r.schoolId.toLowerCase().includes(q) && !(r.contactPerson || '').toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [rows, filterState, filterDistrict, filterCity, search]);

  const totalAllocated = filtered.reduce((s, r) => s + r.allocated, 0);
  const totalRegistered = filtered.reduce((s, r) => s + r.registered, 0);
  const totalVerified = filtered.reduce((s, r) => s + r.verified, 0);

  const exportCSV = () => {
    if (filtered.length === 0) return;
    const headers = ['#', 'School ID', 'CRM ID', 'School Name', 'City', 'District', 'State', 'Contact Person', 'Phone', 'Allocated IDs', 'Registered', 'Verified', 'Pending', 'Registration %'];
    const dataRows = filtered.map((r, i) => [
      i + 1, r.schoolId, r.olympiadId || '-', r.name, r.city || '-', r.district || '-', r.state || '-',
      r.contactPerson || '-', r.phone || '-',
      r.allocated, r.registered, r.verified, r.registered - r.verified,
      r.allocated > 0 ? `${Math.round((r.registered / r.allocated) * 100)}%` : '0%',
    ]);
    const csv = [headers, ...dataRows].map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `school-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const sel = "h-9 border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:border-[#06013E] focus:ring-1 focus:ring-[#06013E] w-full";

  return (
    <div className="space-y-2">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium text-[#004f9f]">School Report</h1>
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
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">State</label>
            <select value={filterState} onChange={e => { setFilterState(e.target.value); setFilterDistrict('All'); setFilterCity('All'); }} className={sel}>
              {states.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">District</label>
            <select value={filterDistrict} onChange={e => { setFilterDistrict(e.target.value); setFilterCity('All'); }} className={sel}>
              {districts.map(d => <option key={d}>{d}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">City</label>
            <select value={filterCity} onChange={e => setFilterCity(e.target.value)} className={sel}>
              {cities.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Search</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
              <input type="text" placeholder="School name / ID..." value={search} onChange={e => setSearch(e.target.value)} autoComplete="off"
                className="h-9 w-full border border-gray-200 pl-8 pr-3 text-sm focus:outline-none focus:border-[#06013E] focus:ring-1 focus:ring-[#06013E]" />
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-stretch border border-gray-200 bg-white divide-x divide-gray-200">
        <div className="flex items-center gap-3 px-6 py-3">
          <Building2 size={17} className="text-[#004f9f]" />
          <span className="text-2xl font-bold text-[#004f9f]">{filtered.length}</span>
          <span className="text-sm text-gray-400">Schools</span>
        </div>
        <div className="flex items-center gap-3 px-6 py-3">
          <Users size={17} className="text-blue-600" />
          <span className="text-2xl font-bold text-blue-700">{totalAllocated}</span>
          <span className="text-sm text-gray-400">Allocated</span>
        </div>
        <div className="flex items-center gap-3 px-6 py-3">
          <CheckCircle2 size={17} className="text-green-600" />
          <span className="text-2xl font-bold text-green-700">{totalRegistered}</span>
          <span className="text-sm text-gray-400">Registered</span>
        </div>
        <div className="flex items-center gap-3 px-6 py-3">
          <Clock3 size={17} className="text-orange-500" />
          <span className="text-2xl font-bold text-orange-600">{totalAllocated - totalRegistered}</span>
          <span className="text-sm text-gray-400">Pending</span>
        </div>
        <div className="flex items-center gap-3 px-6 py-3">
          <TrendingUp size={17} className="text-purple-600" />
          <span className="text-2xl font-bold text-purple-700">
            {totalAllocated > 0 ? Math.round((totalRegistered / totalAllocated) * 100) : 0}%
          </span>
          <span className="text-sm text-gray-400">Reg. Rate</span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-600">
            <span className="text-[#004f9f]">{filtered.length}</span> schools
          </p>
          {loading && <Loader2 size={14} className="animate-spin text-gray-400" />}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse min-w-[640px]">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-gray-500">
                <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider w-10">S.No</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider">School ID</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider">CRM ID</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider">School Name</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider">City</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider">State</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider">Contact</th>
                <th className="px-4 py-2.5 text-center text-[11px] font-bold uppercase tracking-wider">Allocated</th>
                <th className="px-4 py-2.5 text-center text-[11px] font-bold uppercase tracking-wider">Registered</th>
                <th className="px-4 py-2.5 text-center text-[11px] font-bold uppercase tracking-wider">Pending</th>
                <th className="px-4 py-2.5 text-center text-[11px] font-bold uppercase tracking-wider">Reg. %</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} className="py-16 text-center">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto text-[#004f9f] mb-2" />
                  <p className="text-gray-400 text-sm">Loading...</p>
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={10} className="py-16 text-center text-gray-400 text-sm">
                  {rows.length === 0 ? 'No schools found.' : 'No records match your filters.'}
                </td></tr>
              ) : filtered.map((r, idx) => {
                const pending = r.allocated - r.registered;
                const pct = r.allocated > 0 ? Math.round((r.registered / r.allocated) * 100) : 0;
                return (
                  <tr key={r.id} className={`border-b border-gray-100 hover:bg-blue-50/30 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}>
                    <td className="px-4 py-2.5 text-gray-400 text-xs">{idx + 1}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-amber-700 font-semibold">{r.schoolId}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-400">{r.olympiadId || '-'}</td>
                    <td className="px-4 py-2.5 font-semibold text-[#004f9f]">{r.name}</td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs">{r.city || '-'}</td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs">{r.state || '-'}</td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs whitespace-nowrap">{r.contactPerson || '-'}</td>
                    <td className="px-4 py-2.5 text-center font-bold text-blue-700">{r.allocated}</td>
                    <td className="px-4 py-2.5 text-center font-bold text-green-700">{r.registered}</td>
                    <td className="px-4 py-2.5 text-center">
                      {pending > 0
                        ? <span className="font-bold text-orange-600">{pending}</span>
                        : <span className="text-gray-300">0</span>}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <span className={`text-xs font-bold ${pct === 100 ? 'text-green-700' : pct > 50 ? 'text-blue-700' : 'text-orange-600'}`}>{pct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!loading && rows.length > 0 && (
          <div className="px-5 py-2.5 border-t border-gray-100 flex justify-between items-center text-xs text-gray-400">
            <span>Showing <span className="font-semibold text-gray-600">{filtered.length}</span> of <span className="font-semibold text-gray-600">{rows.length}</span> schools</span>
            <span className="italic">© mittmee</span>
          </div>
        )}
      </div>
    </div>
  );
}

