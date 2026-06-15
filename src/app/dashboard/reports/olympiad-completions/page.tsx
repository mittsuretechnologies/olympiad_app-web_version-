'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/swr';
import {
  Trophy, Loader2, Search, Download,
  Users, Building2, Filter, X, CheckCircle2, Video
} from 'lucide-react';

interface Completion {
  id: string;
  name: string;
  username: string | null;
  phone: string;
  olympiadCode: string;
  approvedVideos: number;
  classCode: string | null;
  className: string | null;
  source: 'web' | 'app';
  completedAt: string;
  school: {
    id: string;
    schoolId: string;
    name: string;
    city: string | null;
    state: string | null;
    district: string | null;
  } | null;
}

export default function OlympiadCompletionsPage() {
  const { data, isLoading: loading } = useSWR<Completion[]>('/api/reports/olympiad-completions', fetcher);
  const rows: Completion[] = Array.isArray(data) ? data : [];

  const [search, setSearch] = useState('');
  const [filterState, setFilterState] = useState('All');
  const [filterDistrict, setFilterDistrict] = useState('All');
  const [filterCity, setFilterCity] = useState('All');
  const [filterSchool, setFilterSchool] = useState('All');
  const [filterClass, setFilterClass] = useState('All');

  const states = useMemo(() => ['All', ...Array.from(new Set(rows.map(r => r.school?.state).filter(Boolean) as string[])).sort()], [rows]);
  const districts = useMemo(() => {
    const base = rows.filter(r => filterState === 'All' || r.school?.state === filterState);
    return ['All', ...Array.from(new Set(base.map(r => r.school?.district).filter(Boolean) as string[])).sort()];
  }, [rows, filterState]);
  const cities = useMemo(() => {
    const base = rows.filter(r =>
      (filterState === 'All' || r.school?.state === filterState) &&
      (filterDistrict === 'All' || r.school?.district === filterDistrict)
    );
    return ['All', ...Array.from(new Set(base.map(r => r.school?.city).filter(Boolean) as string[])).sort()];
  }, [rows, filterState, filterDistrict]);
  const schools = useMemo(() => {
    const base = rows.filter(r =>
      (filterState === 'All' || r.school?.state === filterState) &&
      (filterDistrict === 'All' || r.school?.district === filterDistrict) &&
      (filterCity === 'All' || r.school?.city === filterCity)
    );
    const unique = Array.from(new Map(base.map(r => [r.school?.schoolId, r.school?.name])).entries())
      .filter(([id]) => id)
      .sort((a, b) => (a[1] || '').localeCompare(b[1] || ''));
    return [['All', 'All Schools'], ...unique] as [string, string][];
  }, [rows, filterState, filterDistrict, filterCity]);
  const classes = useMemo(() => {
    return ['All', ...Array.from(new Set(rows.map(r => r.className).filter(Boolean) as string[])).sort()];
  }, [rows]);

  const activeFilterCount = [filterState, filterDistrict, filterCity, filterSchool, filterClass].filter(v => v !== 'All').length;

  const clearFilters = () => {
    setFilterState('All'); setFilterDistrict('All'); setFilterCity('All');
    setFilterSchool('All'); setFilterClass('All'); setSearch('');
  };

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (filterState !== 'All' && r.school?.state !== filterState) return false;
      if (filterDistrict !== 'All' && r.school?.district !== filterDistrict) return false;
      if (filterCity !== 'All' && r.school?.city !== filterCity) return false;
      if (filterSchool !== 'All' && r.school?.schoolId !== filterSchool) return false;
      if (filterClass !== 'All' && r.className !== filterClass) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !r.olympiadCode?.toLowerCase().includes(q) &&
          !r.name?.toLowerCase().includes(q) &&
          !r.username?.toLowerCase().includes(q) &&
          !r.phone?.toLowerCase().includes(q) &&
          !r.school?.name?.toLowerCase().includes(q) &&
          !r.school?.schoolId?.toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [rows, filterState, filterDistrict, filterCity, filterSchool, filterClass, search]);

  const schoolCount = new Set(filtered.map(r => r.school?.schoolId).filter(Boolean)).size;

  const exportCSV = () => {
    if (filtered.length === 0) return;
    const headers = ['#', 'Student Name', 'Username', 'Phone', 'Olympiad ID', 'Class', 'Videos', 'Source', 'School ID', 'School Name', 'City', 'State', 'District'];
    const dataRows = filtered.map((r, i) => [
      i + 1, r.name, r.username || '-', r.phone, r.olympiadCode,
      r.className || '-', r.approvedVideos,
      r.source,
      r.school?.schoolId || '-', r.school?.name || '-',
      r.school?.city || '-', r.school?.state || '-', r.school?.district || '-',
    ]);
    const csv = [headers, ...dataRows]
      .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `olympiad-completions-${new Date().toISOString().split('T')[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const sel = "h-9 border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:border-[#06013E] focus:ring-1 focus:ring-[#06013E] w-full";

  return (
    <div className="space-y-2">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium text-[#06013E]">Olympiad Completions</h1>
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
        <div className="p-5 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">State</label>
            <select value={filterState} onChange={e => { setFilterState(e.target.value); setFilterDistrict('All'); setFilterCity('All'); setFilterSchool('All'); }} className={sel}>
              {states.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">District</label>
            <select value={filterDistrict} onChange={e => { setFilterDistrict(e.target.value); setFilterCity('All'); setFilterSchool('All'); }} className={sel}>
              {districts.map(d => <option key={d}>{d}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">City</label>
            <select value={filterCity} onChange={e => { setFilterCity(e.target.value); setFilterSchool('All'); }} className={sel}>
              {cities.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="space-y-1 col-span-2">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">School</label>
            <select value={filterSchool} onChange={e => setFilterSchool(e.target.value)} className={sel}>
              {schools.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Class</label>
            <select value={filterClass} onChange={e => setFilterClass(e.target.value)} className={sel}>
              {classes.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Search</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
              <input type="text" placeholder="Name / ID / School..." value={search} onChange={e => setSearch(e.target.value)} autoComplete="off"
                className="h-9 w-full border border-gray-200 pl-8 pr-3 text-sm focus:outline-none focus:border-[#06013E] focus:ring-1 focus:ring-[#06013E]" />
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-stretch border border-gray-200 bg-white divide-x divide-gray-200">
        <div className="flex items-center gap-3 px-6 py-3">
          <Trophy size={17} className="text-amber-500" />
          <span className="text-2xl font-bold text-[#06013E]">{filtered.length}</span>
          <span className="text-sm text-gray-400">Completed</span>
        </div>
        <div className="flex items-center gap-3 px-6 py-3">
          <Building2 size={17} className="text-blue-600" />
          <span className="text-2xl font-bold text-blue-700">{schoolCount}</span>
          <span className="text-sm text-gray-400">Schools</span>
        </div>
        <div className="flex items-center gap-3 px-6 py-3">
          <Users size={17} className="text-purple-600" />
          <span className="text-2xl font-bold text-purple-700">{filtered.filter(r => r.source === 'app').length}</span>
          <span className="text-sm text-gray-400">Via App</span>
        </div>
        <div className="flex items-center gap-3 px-6 py-3">
          <CheckCircle2 size={17} className="text-green-600" />
          <span className="text-2xl font-bold text-green-700">{filtered.filter(r => r.source === 'web').length}</span>
          <span className="text-sm text-gray-400">Via Web</span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-600">
            <span className="text-[#06013E]">{filtered.length}</span> students completed participation
          </p>
          {loading && <Loader2 size={14} className="animate-spin text-gray-400" />}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-gray-500">
                <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider w-10">#</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider">Student Name</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider">Username</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider">Olympiad ID</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider">Class</th>
                <th className="px-4 py-2.5 text-center text-[11px] font-bold uppercase tracking-wider">Videos</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider">Via</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider">School</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider">City</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider">State</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} className="py-16 text-center">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto text-[#06013E] mb-2" />
                  <p className="text-gray-400 text-sm">Loading...</p>
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={10} className="py-16 text-center">
                  <Trophy className="w-8 h-8 mx-auto text-gray-200 mb-2" />
                  <p className="text-gray-400 text-sm">
                    {rows.length === 0 ? 'No students have completed participation yet.' : 'No records match your filters.'}
                  </p>
                </td></tr>
              ) : filtered.map((r, idx) => (
                <tr key={r.id} className={`border-b border-gray-100 hover:bg-amber-50/30 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}>
                  <td className="px-4 py-2.5 text-gray-400 text-xs">{idx + 1}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-amber-500 text-sm">🏅</span>
                      <span className={`font-semibold ${r.source === 'app' && r.name === r.username ? 'text-gray-400 italic' : 'text-gray-900'}`}>
                        {r.name}
                      </span>
                      {r.source === 'app' && r.name === r.username && (
                        <span className="text-[10px] text-orange-400">(no name set)</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    {r.username
                      ? <span className="font-mono text-xs text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5">{r.username}</span>
                      : <span className="text-gray-300 text-xs">-</span>
                    }
                  </td>
                  <td className="px-4 py-2.5 font-mono font-bold text-[#06013E] select-all text-sm">{r.olympiadCode}</td>
                  <td className="px-4 py-2.5 text-gray-600 text-xs">{r.className || '-'}</td>
                  <td className="px-4 py-2.5 text-center">
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5">
                      <Video size={10} />{r.approvedVideos}/2
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    {r.source === 'app'
                      ? <span className="text-[11px] font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5">App</span>
                      : <span className="text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5">Web</span>
                    }
                  </td>
                  <td className="px-4 py-2.5">
                    {r.school
                      ? <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5">{r.school.schoolId}</span>
                          <span className="text-xs text-gray-600">{r.school.name}</span>
                        </div>
                      : <span className="text-gray-300">-</span>}
                  </td>
                  <td className="px-4 py-2.5 text-gray-400 text-xs">{r.school?.city || '-'}</td>
                  <td className="px-4 py-2.5 text-gray-400 text-xs">{r.school?.state || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && rows.length > 0 && (
          <div className="px-5 py-2.5 border-t border-gray-100 flex justify-between items-center text-xs text-gray-400">
            <span>Showing <span className="font-semibold text-gray-600">{filtered.length}</span> of <span className="font-semibold text-gray-600">{rows.length}</span> completions</span>
            <span className="italic">© Mittsure Olympiad Portal</span>
          </div>
        )}
      </div>
    </div>
  );
}
