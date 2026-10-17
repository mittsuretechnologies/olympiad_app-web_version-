'use client';

import { Fragment, useMemo, useState } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/swr';
import { CLASSES } from '@/lib/classes';
import {
  School, Loader2, Search, Download,
  Building2, Users, CheckCircle2, Clock3, Filter, X, TrendingUp, ChevronRight, ChevronDown, LogIn
} from 'lucide-react';

interface ClassBreakdown {
  className: string;
  generated: number;
  allotted: number;
  registered: number;
  loggedIn: number;
}

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
  /** IDs given to a student (name entered, registered, or app account linked). */
  allotted: number;
  /** Allotted IDs whose student has logged in (web or app) at least once. */
  loggedIn: number;
  classes: ClassBreakdown[];
}

export default function SchoolReportPage() {
  const { data, isLoading: loading } = useSWR<SchoolReport[]>('/api/reports/schools', fetcher);
  const rows: SchoolReport[] = Array.isArray(data) ? data : [];

  const [search, setSearch] = useState('');
  const [filterState, setFilterState] = useState('All');
  const [filterDistrict, setFilterDistrict] = useState('All');
  const [filterCity, setFilterCity] = useState('All');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleExpanded = (id: string) => setExpanded(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

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
  const totalAllotted = filtered.reduce((s, r) => s + r.allotted, 0);
  const totalLoggedIn = filtered.reduce((s, r) => s + r.loggedIn, 0);
  // Usage = of the students given an ID, how many actually logged in.
  const pctOf = (part: number, whole: number) => whole > 0 ? Math.round((part / whole) * 100) : 0;

  const downloadCSV = (headers: (string | number)[], dataRows: (string | number)[][], name: string) => {
    const csv = [headers, ...dataRows].map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${name}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  // One row per school with a column per class (IDs generated), for the same
  // filtered schools as the table. A "No class" column appears only when some
  // older IDs were issued without a class.
  const exportClassWiseCSV = () => {
    const withIds = filtered.filter(r => r.classes.length > 0);
    if (withIds.length === 0) return;
    const classNames = CLASSES.map(c => c.name);
    const hasNoClass = withIds.some(r => r.classes.some(c => !classNames.includes(c.className)));
    const headers = ['#', 'School ID', 'CRM ID', 'School Name', 'City', 'District', 'State', ...classNames, ...(hasNoClass ? ['No class'] : []), 'Total IDs'];
    const dataRows = withIds.map((r, i) => {
      const count = (name: string) => r.classes.find(c => c.className === name)?.generated ?? 0;
      const other = r.classes.filter(c => !classNames.includes(c.className)).reduce((s, c) => s + c.generated, 0);
      return [
        i + 1, r.schoolId, r.olympiadId || '-', r.name, r.city || '-', r.district || '-', r.state || '-',
        ...classNames.map(count), ...(hasNoClass ? [other] : []), r.allocated,
      ];
    });
    downloadCSV(headers, dataRows, 'school-classwise-ids');
  };

  const exportCSV = () => {
    if (filtered.length === 0) return;
    const headers = [
      '#', 'School ID', 'CRM ID', 'School Name', 'City', 'District', 'State', 'Contact Person', 'Phone',
      'Allocated IDs', 'Allotted', 'Registered', 'Verified', 'Pending Registration', 'Registration %',
      'Logged In On App', 'Not Logged In', 'Usage %',
    ];
    const numbers = (allocated: number, allotted: number, registered: number, verified: number, loggedIn: number) => [
      allocated, allotted, registered, verified, allocated - registered, `${pctOf(registered, allocated)}%`,
      loggedIn, allotted - loggedIn, `${pctOf(loggedIn, allotted)}%`,
    ];
    const totalRow = [
      '', '', '', `TOTAL (${filtered.length} schools)`, '', '', '', '', '',
      ...numbers(totalAllocated, totalAllotted, totalRegistered, totalVerified, totalLoggedIn),
    ];
    const dataRows = filtered.map((r, i) => [
      i + 1, r.schoolId, r.olympiadId || '-', r.name, r.city || '-', r.district || '-', r.state || '-',
      r.contactPerson || '-', r.phone || '-',
      ...numbers(r.allocated, r.allotted, r.registered, r.verified, r.loggedIn),
    ]);
    downloadCSV(headers, [totalRow, ...dataRows], 'school-report');
  };

  const sel = "h-9 border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:border-[#06013E] focus:ring-1 focus:ring-[#06013E] w-full";

  return (
    <div className="space-y-2">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium text-[#004f9f]">School Report</h1>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={exportClassWiseCSV} disabled={!filtered.some(r => r.classes.length > 0)}
            className="inline-flex items-center gap-2 bg-white border border-[#06013E] text-[#06013E] px-4 py-2.5 text-sm font-semibold hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            <Download size={14} /> Export Class-wise CSV
          </button>
          <button onClick={exportCSV} disabled={filtered.length === 0}
            className="inline-flex items-center gap-2 bg-[#06013E] text-white px-4 py-2.5 text-sm font-semibold hover:bg-[#09025c] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            <Download size={14} /> Export CSV
          </button>
        </div>
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
      <div className="flex items-stretch border border-gray-200 bg-white divide-x divide-gray-200 overflow-x-auto">
        <div className="flex items-center gap-3 px-6 py-3">
          <Building2 size={17} className="text-[#004f9f]" />
          <span className="text-2xl font-bold text-[#004f9f]">{filtered.length}</span>
          <span className="text-sm text-gray-400">Schools</span>
        </div>
        <div className="flex items-center gap-3 px-6 py-3">
          <Users size={17} className="text-blue-600" />
          <span className="text-2xl font-bold text-blue-700">{totalAllocated}</span>
          <span className="text-sm text-gray-400 whitespace-nowrap">IDs Generated</span>
        </div>
        <div className="flex items-center gap-3 px-6 py-3">
          <CheckCircle2 size={17} className="text-[#004f9f]" />
          <span className="text-2xl font-bold text-[#004f9f]">{totalAllotted}</span>
          <span className="text-sm text-gray-400">Allotted</span>
        </div>
        <div className="flex items-center gap-3 px-6 py-3">
          <LogIn size={17} className="text-green-600" />
          <span className="text-2xl font-bold text-green-700">{totalLoggedIn}</span>
          <span className="text-sm text-gray-400 whitespace-nowrap">Logged In</span>
        </div>
        <div className="flex items-center gap-3 px-6 py-3">
          <Clock3 size={17} className="text-orange-500" />
          <span className="text-2xl font-bold text-orange-600">{totalAllotted - totalLoggedIn}</span>
          <span className="text-sm text-gray-400 whitespace-nowrap">Not Logged In</span>
        </div>
        <div className="flex items-center gap-3 px-6 py-3">
          <TrendingUp size={17} className="text-purple-600" />
          <span className="text-2xl font-bold text-purple-700">{pctOf(totalLoggedIn, totalAllotted)}%</span>
          <span className="text-sm text-gray-400 whitespace-nowrap">Usage</span>
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
                <th className="w-8" aria-label="Class-wise" />
                <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider w-10">S.No</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider">School ID</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider">CRM ID</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider">School Name</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider">City</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider">State</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider">Contact</th>
                <th className="px-4 py-2.5 text-center text-[11px] font-bold uppercase tracking-wider">IDs</th>
                <th className="px-4 py-2.5 text-center text-[11px] font-bold uppercase tracking-wider">Allotted</th>
                <th className="px-4 py-2.5 text-center text-[11px] font-bold uppercase tracking-wider">Registered</th>
                <th className="px-4 py-2.5 text-center text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">Logged In</th>
                <th className="px-4 py-2.5 text-center text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">Not Logged In</th>
                <th className="px-4 py-2.5 text-center text-[11px] font-bold uppercase tracking-wider" title="Logged in ÷ allotted">Usage %</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={14} className="py-16 text-center">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto text-[#004f9f] mb-2" />
                  <p className="text-gray-400 text-sm">Loading...</p>
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={14} className="py-16 text-center text-gray-400 text-sm">
                  {rows.length === 0 ? 'No schools found.' : 'No records match your filters.'}
                </td></tr>
              ) : [
                <tr key="total" className="border-b-2 border-gray-200 bg-[#004f9f]/5 font-bold">
                  <td colSpan={8} className="px-4 py-2.5 text-xs uppercase tracking-wider text-[#004f9f]">
                    Total · {filtered.length} schools
                  </td>
                  <FunnelCells allocated={totalAllocated} allotted={totalAllotted} registered={totalRegistered} loggedIn={totalLoggedIn} />
                </tr>,
                ...filtered.map((r, idx) => {
                const isOpen = expanded.has(r.id);
                return (
                  <Fragment key={r.id}>
                  <tr className={`border-b border-gray-100 hover:bg-blue-50/30 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}>
                    <td className="pl-3 py-2.5">
                      {r.classes.length > 0 && (
                        <button onClick={() => toggleExpanded(r.id)} title={isOpen ? 'Hide class-wise IDs' : 'Show class-wise IDs'}
                          className="p-0.5 text-gray-400 hover:text-[#004f9f]">
                          {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-gray-400 text-xs">{idx + 1}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-amber-700 font-semibold">{r.schoolId}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-400">{r.olympiadId || '-'}</td>
                    <td className="px-4 py-2.5 font-semibold text-[#004f9f]">{r.name}</td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs">{r.city || '-'}</td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs">{r.state || '-'}</td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs whitespace-nowrap">{r.contactPerson || '-'}</td>
                    <FunnelCells allocated={r.allocated} allotted={r.allotted} registered={r.registered} loggedIn={r.loggedIn} />
                  </tr>
                  {isOpen && (
                    <tr className="border-b border-gray-100 bg-blue-50/40">
                      <td />
                      <td colSpan={13} className="px-4 py-3">
                        <table className="text-xs border border-gray-200 bg-white">
                          <thead>
                            <tr className="bg-gray-50 text-gray-500">
                              <th className="px-3 py-1.5 text-left font-bold uppercase tracking-wider">Class</th>
                              <th className="px-3 py-1.5 text-center font-bold uppercase tracking-wider">Generated</th>
                              <th className="px-3 py-1.5 text-center font-bold uppercase tracking-wider">Allotted</th>
                              <th className="px-3 py-1.5 text-center font-bold uppercase tracking-wider">Unallotted</th>
                              <th className="px-3 py-1.5 text-center font-bold uppercase tracking-wider">Registered</th>
                              <th className="px-3 py-1.5 text-center font-bold uppercase tracking-wider">Logged In</th>
                            </tr>
                          </thead>
                          <tbody>
                            {r.classes.map(c => (
                              <tr key={c.className || 'no-class'} className="border-t border-gray-100">
                                <td className="px-3 py-1.5 font-semibold text-[#004f9f]">{c.className || 'No class'}</td>
                                <td className="px-3 py-1.5 text-center font-bold text-blue-700">{c.generated}</td>
                                <td className="px-3 py-1.5 text-center font-bold text-[#004f9f]">{c.allotted}</td>
                                <td className="px-3 py-1.5 text-center font-bold text-orange-600">{c.generated - c.allotted}</td>
                                <td className="px-3 py-1.5 text-center font-bold text-green-700">{c.registered}</td>
                                <td className="px-3 py-1.5 text-center font-bold text-green-700">{c.loggedIn}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                );
              })]}
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


// IDs → allotted → registered → logged in, for one school or the totals row.
function FunnelCells({ allocated, allotted, registered, loggedIn }: { allocated: number; allotted: number; registered: number; loggedIn: number }) {
  const notLoggedIn = allotted - loggedIn;
  const usage = allotted > 0 ? Math.round((loggedIn / allotted) * 100) : 0;
  return (
    <>
      <td className="px-4 py-2.5 text-center font-bold text-blue-700">{allocated}</td>
      <td className="px-4 py-2.5 text-center font-bold text-[#004f9f]">{allotted}</td>
      <td className="px-4 py-2.5 text-center font-bold text-green-700">{registered}</td>
      <td className="px-4 py-2.5 text-center font-bold text-green-700">{loggedIn}</td>
      <td className="px-4 py-2.5 text-center">
        {notLoggedIn > 0
          ? <span className="font-bold text-orange-600">{notLoggedIn}</span>
          : <span className="text-gray-300">0</span>}
      </td>
      <td className="px-4 py-2.5 text-center">
        <div className="flex items-center justify-center gap-2">
          <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${usage}%` }} />
          </div>
          <span className={`text-xs font-bold ${usage === 100 ? 'text-green-700' : usage > 50 ? 'text-blue-700' : 'text-orange-600'}`}>{usage}%</span>
        </div>
      </td>
    </>
  );
}
