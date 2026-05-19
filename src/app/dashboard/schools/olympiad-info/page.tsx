'use client';

import { useEffect, useMemo, useState } from 'react';
import { Hash, Loader2, Search, Download, ChevronRight, ChevronDown } from 'lucide-react';

interface AllocRow {
  id: string;
  code: string;
  sentAt?: string | null;
  createdAt: string;
  school: {
    schoolId: string;
    name: string;
    city?: string | null;
    state?: string | null;
  };
  student?: {
    name: string;
    phone: string;
    createdAt: string;
  } | null;
}

interface SchoolGroup {
  schoolId: string;
  schoolName: string;
  city?: string | null;
  state?: string | null;
  total: number;
  registered: number;
  pending: number;
  rows: AllocRow[];
}

export default function OlympiadInfoPage() {
  const [rows, setRows] = useState<AllocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'REGISTERED' | 'PENDING'>('ALL');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch('/api/schools/olympiad-ids')
      .then((res) => res.json())
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (statusFilter === 'REGISTERED' && !r.student) return false;
      if (statusFilter === 'PENDING' && r.student) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !r.code.toLowerCase().includes(q) &&
          !(r.student?.name || '').toLowerCase().includes(q) &&
          !(r.student?.phone || '').toLowerCase().includes(q) &&
          !r.school.name.toLowerCase().includes(q) &&
          !r.school.schoolId.toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [rows, search, statusFilter]);

  const groups = useMemo<SchoolGroup[]>(() => {
    const map = new Map<string, SchoolGroup>();
    filteredRows.forEach((r) => {
      const key = r.school.schoolId;
      let g = map.get(key);
      if (!g) {
        g = { schoolId: r.school.schoolId, schoolName: r.school.name, city: r.school.city, state: r.school.state, total: 0, registered: 0, pending: 0, rows: [] };
        map.set(key, g);
      }
      g.total += 1;
      if (r.student) g.registered += 1;
      else g.pending += 1;
      g.rows.push(r);
    });
    map.forEach((g) => g.rows.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true })));
    return Array.from(map.values()).sort((a, b) => a.schoolId.localeCompare(b.schoolId));
  }, [filteredRows]);

  const stats = useMemo(() => {
    const total = rows.length;
    const registered = rows.filter((r) => r.student).length;
    return { total, registered, pending: total - registered, schools: new Set(rows.map((r) => r.school.schoolId)).size };
  }, [rows]);

  const toggleAll = (expand: boolean) => {
    const next: Record<string, boolean> = {};
    groups.forEach((g) => { next[g.schoolId] = expand; });
    setExpanded(next);
  };

  const exportCSV = () => {
    if (filteredRows.length === 0) return;
    const csvRows = [
      ['School ID', 'School Name', 'Olympiad ID', 'Student Name', 'Phone', 'Status', 'Registered On'],
      ...filteredRows.map((r) => [
        r.school.schoolId, r.school.name, r.code,
        r.student?.name || '', r.student?.phone || '',
        r.student ? 'REGISTERED' : 'PENDING',
        r.student ? new Date(r.student.createdAt).toLocaleDateString() : '',
      ]),
    ];
    const csv = csvRows.map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `olympiad-ids-info.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white border border-gray-300 shadow-sm">
      <div className="bg-[#06013E] text-white px-6 py-3 flex items-center justify-between border-b-4 border-[#FF9000]">
        <div className="flex items-center gap-3">
          <Hash size={20} />
          <h1 className="text-base font-bold uppercase tracking-wider">Olympiad ID Info</h1>
        </div>
        <div className="text-xs text-gray-300">All schools · expand to view IDs · student registration status</div>
      </div>

      <div className="bg-gray-50 border-b border-gray-300 px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4 text-sm">
          <span><span className="text-gray-600">Schools: </span><span className="font-bold text-[#06013E]">{stats.schools}</span></span>
          <span><span className="text-gray-600">Total IDs: </span><span className="font-bold text-[#06013E]">{stats.total}</span></span>
          <span><span className="text-gray-600">Registered: </span><span className="font-bold text-green-700">{stats.registered}</span></span>
          <span><span className="text-gray-600">Pending: </span><span className="font-bold text-orange-700">{stats.pending}</span></span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => toggleAll(true)} className="text-xs font-semibold text-[#06013E] border border-gray-400 bg-white px-3 py-1.5 hover:bg-gray-100">Expand All</button>
          <button onClick={() => toggleAll(false)} className="text-xs font-semibold text-[#06013E] border border-gray-400 bg-white px-3 py-1.5 hover:bg-gray-100">Collapse All</button>
          <button onClick={exportCSV} disabled={filteredRows.length === 0}
            className="inline-flex items-center gap-2 bg-[#06013E] text-white px-4 py-2 text-sm font-semibold hover:bg-[#0a0660] disabled:opacity-50">
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

      <div className="px-6 py-3 border-b border-gray-300 bg-white flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input type="text" placeholder="Search by school, ID, student name or phone..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 text-sm focus:outline-none focus:border-[#06013E] focus:ring-1 focus:ring-[#06013E]"
          />
        </div>
        <div className="flex items-center gap-1 border border-gray-300">
          {(['ALL', 'REGISTERED', 'PENDING'] as const).map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-xs font-semibold transition-colors ${statusFilter === s ? 'bg-[#06013E] text-white' : 'text-gray-700 hover:bg-gray-100'}`}
            >{s}</button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-[#E8EAF6] border-b-2 border-[#06013E] text-[#06013E]">
              <th className="px-4 py-3 text-left text-xs font-bold uppercase border-r border-gray-300 w-10"></th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase border-r border-gray-300 w-12">#</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase border-r border-gray-300">School ID</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase border-r border-gray-300">School Name</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase border-r border-gray-300">Location</th>
              <th className="px-4 py-3 text-center text-xs font-bold uppercase border-r border-gray-300">Total IDs</th>
              <th className="px-4 py-3 text-center text-xs font-bold uppercase border-r border-gray-300">Registered</th>
              <th className="px-4 py-3 text-center text-xs font-bold uppercase">Pending</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="py-16 text-center">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#06013E] mb-2" />
                <p className="text-gray-600 text-sm">Loading records...</p>
              </td></tr>
            ) : groups.length === 0 ? (
              <tr><td colSpan={8} className="py-16 text-center text-gray-500 text-sm">
                {rows.length === 0 ? 'No Olympiad IDs allocated yet.' : 'No records match your filters.'}
              </td></tr>
            ) : (
              groups.map((g, idx) => {
                const isOpen = !!expanded[g.schoolId];
                return (
                  <FragmentRow key={g.schoolId} group={g} idx={idx} isOpen={isOpen}
                    onToggle={() => setExpanded((prev) => ({ ...prev, [g.schoolId]: !prev[g.schoolId] }))}
                  />
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="bg-gray-50 border-t border-gray-300 px-6 py-2 text-xs text-gray-600 flex justify-between items-center">
        <span>Showing <span className="font-bold">{groups.length}</span> school(s) · <span className="font-bold">{filteredRows.length}</span> of <span className="font-bold">{rows.length}</span> records</span>
        <span className="italic">© Mittsure Olympiad Portal</span>
      </div>
    </div>
  );
}

function FragmentRow({ group: g, idx, isOpen, onToggle }: { group: SchoolGroup; idx: number; isOpen: boolean; onToggle: () => void; }) {
  const rowBg = idx % 2 === 0 ? 'bg-white' : 'bg-gray-50';
  return (
    <>
      <tr onClick={onToggle} className={`border-b border-gray-200 ${rowBg} hover:bg-yellow-50 cursor-pointer`}>
        <td className="px-4 py-3 border-r border-gray-200 text-[#06013E]">
          {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </td>
        <td className="px-4 py-3 border-r border-gray-200 text-gray-700 text-xs">{idx + 1}</td>
        <td className="px-4 py-3 border-r border-gray-200 font-mono font-semibold text-[#06013E]">{g.schoolId}</td>
        <td className="px-4 py-3 border-r border-gray-200 font-semibold text-gray-900">{g.schoolName}</td>
        <td className="px-4 py-3 border-r border-gray-200 text-gray-700 text-xs">{[g.city, g.state].filter(Boolean).join(', ') || '-'}</td>
        <td className="px-4 py-3 border-r border-gray-200 text-center font-bold text-[#06013E]">{g.total}</td>
        <td className="px-4 py-3 border-r border-gray-200 text-center font-bold text-green-700">{g.registered}</td>
        <td className="px-4 py-3 text-center font-bold text-orange-700">{g.pending}</td>
      </tr>

      {isOpen && (
        <tr className="bg-blue-50/30">
          <td colSpan={8} className="p-0">
            <div className="px-8 py-4 border-l-4 border-[#06013E]">
              <div className="text-xs font-bold text-[#06013E] uppercase tracking-wider mb-2 flex items-center gap-2">
                <Hash className="w-3.5 h-3.5" /> Olympiad IDs for {g.schoolName}
              </div>
              <div className="border border-gray-300 bg-white overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#E8EAF6] border-b-2 border-[#06013E] text-[#06013E]">
                      <th className="px-3 py-2 text-left text-xs font-bold uppercase border-r border-gray-300 w-12">#</th>
                      <th className="px-3 py-2 text-left text-xs font-bold uppercase border-r border-gray-300">Olympiad ID</th>
                      <th className="px-3 py-2 text-left text-xs font-bold uppercase border-r border-gray-300">Student Name</th>
                      <th className="px-3 py-2 text-left text-xs font-bold uppercase border-r border-gray-300">Phone</th>
                      <th className="px-3 py-2 text-left text-xs font-bold uppercase border-r border-gray-300">Registration</th>
                      <th className="px-3 py-2 text-left text-xs font-bold uppercase">Registered On</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.rows.map((r, i) => (
                      <tr key={r.id} className={`border-b border-gray-200 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                        <td className="px-3 py-2 border-r border-gray-200 text-gray-700 text-xs">{i + 1}</td>
                        <td className="px-3 py-2 border-r border-gray-200 font-mono font-semibold text-[#06013E]">{r.code}</td>
                        <td className="px-3 py-2 border-r border-gray-200 text-gray-800">{r.student?.name || <span className="text-gray-400 italic">-</span>}</td>
                        <td className="px-3 py-2 border-r border-gray-200 font-mono text-xs text-gray-800">{r.student?.phone || <span className="text-gray-400 italic">-</span>}</td>
                        <td className="px-3 py-2 border-r border-gray-200">
                          <span className={`inline-block px-2 py-0.5 text-[10px] font-bold uppercase ${
                            r.student
                              ? 'bg-green-100 text-green-800 border border-green-300'
                              : 'bg-orange-100 text-orange-800 border border-orange-300'
                          }`}>
                            {r.student ? 'REGISTERED' : 'PENDING'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-gray-700 text-xs">
                          {r.student ? new Date(r.student.createdAt).toLocaleDateString() : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
