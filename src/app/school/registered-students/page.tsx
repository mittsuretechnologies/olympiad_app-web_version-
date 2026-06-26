'use client';

import { useEffect, useMemo, useState } from 'react';
import { Users, Loader2, Search, Download, CheckCircle2, BookOpen, Calendar, Phone, Award } from 'lucide-react';

interface Student {
  id: string;
  name: string;
  phone: string;
  olympiadCode: string;
  isVerified: boolean;
  createdAt: string;
  classCode: string | null;
  className: string | null;
  source?: 'web' | 'app';
  olympiadVideos?: number;
}

export default function SchoolRegisteredStudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('ALL');
  const [view, setView] = useState<'table' | 'cards'>('table');

  useEffect(() => {
    const token = localStorage.getItem('schoolToken');
    if (!token) { setError('Not logged in'); setLoading(false); return; }

    fetch('/api/school/me/registered-students', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to load');
        setStudents(Array.isArray(data) ? data : []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const classes = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of students) {
      const key = s.classCode || 'UNKNOWN';
      const label = s.className || s.classCode || 'Unknown';
      map.set(key, label);
    }
    return Array.from(map.entries())
      .map(([code, name]) => ({ code, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [students]);

  const filtered = useMemo(() => {
    return students.filter((s) => {
      if (classFilter !== 'ALL' && (s.classCode || 'UNKNOWN') !== classFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !s.name.toLowerCase().includes(q) &&
          !s.olympiadCode.toLowerCase().includes(q) &&
          !s.phone.includes(q)
        ) return false;
      }
      return true;
    });
  }, [students, search, classFilter]);

  const exportCSV = () => {
    if (filtered.length === 0) return;
    const rows = [
      ['#', 'Student Name', 'Olympiad ID', 'Class', 'Phone', 'Registration Date'],
      ...filtered.map((s, i) => [
        i + 1, s.name, s.olympiadCode,
        s.className || s.classCode || '-',
        s.phone,
        new Date(s.createdAt).toLocaleDateString('en-IN'),
      ]),
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `students-${classFilter === 'ALL' ? 'all' : classFilter}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="space-y-3">

      {/* Title bar */}
      <div className="bg-white border border-gray-300">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-300 bg-[#F4F5F7]">
          <div className="flex items-center gap-2">
            <Users size={15} className="text-[#06013E]" />
            <h1 className="text-[13px] font-bold text-[#06013E] uppercase tracking-wide">Registered Students Record</h1>
          </div>
          <button
            onClick={exportCSV}
            disabled={filtered.length === 0}
            className="inline-flex items-center gap-1.5 bg-white text-[#06013E] px-3 py-1.5 text-xs font-semibold hover:bg-gray-50 transition-colors border border-gray-300 disabled:opacity-40"
          >
            <Download size={13} /> Export CSV
          </button>
        </div>

        {/* Stats strip */}
        <div className="flex flex-wrap divide-x divide-gray-200">
          <div className="px-4 py-2.5 flex items-center justify-between min-w-[170px]">
            <span className="text-[11px] text-gray-600 font-medium">Total Registered</span>
            <span className="text-sm font-bold text-green-700 font-mono">{students.length}</span>
          </div>
          {classes.map(cls => {
            const count = students.filter(s => (s.classCode || 'UNKNOWN') === cls.code).length;
            return (
              <div key={cls.code} className="px-4 py-2.5 flex items-center justify-between min-w-[140px]">
                <span className="text-[11px] text-gray-600 font-medium">{cls.name}</span>
                <span className="text-sm font-bold text-[#06013E] font-mono">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filters & View Toggle */}
      <div className="bg-white border border-gray-300 px-4 py-2.5 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
          <input
            type="text"
            placeholder="Search by name, ID or phone"
            className="w-full pl-7 pr-3 py-1.5 border border-gray-300 text-[12px] focus:outline-none focus:border-[#06013E]"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {classes.length > 1 && (
          <div className="flex items-center border border-gray-300 divide-x divide-gray-300">
            <button
              onClick={() => setClassFilter('ALL')}
              className={`px-3 py-1.5 text-[11px] font-semibold transition-colors ${classFilter === 'ALL' ? 'bg-[#06013E] text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
            >All Classes</button>
            {classes.map(cls => (
              <button key={cls.code} onClick={() => setClassFilter(cls.code)}
                className={`px-3 py-1.5 text-[11px] font-semibold transition-colors ${classFilter === cls.code ? 'bg-[#06013E] text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
              >{cls.name}</button>
            ))}
          </div>
        )}

        <div className="ml-auto flex items-center border border-gray-300 divide-x divide-gray-300">
          <button onClick={() => setView('table')}
            className={`px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide transition-colors ${view === 'table' ? 'bg-[#06013E] text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
            Table
          </button>
          <button onClick={() => setView('cards')}
            className={`px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide transition-colors ${view === 'cards' ? 'bg-[#06013E] text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
            Cards
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="bg-white border border-gray-300 py-20 flex flex-col items-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-[#06013E]" />
          <p className="text-sm text-gray-500">Loading student records...</p>
        </div>
      ) : error ? (
        <div className="bg-white border border-red-300 py-16 text-center text-red-700 text-sm">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-gray-300 py-20 text-center">
          <Users size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 text-sm">
            {students.length === 0 ? 'No students have registered yet via the app.' : 'No students match your filters.'}
          </p>
        </div>
      ) : view === 'table' ? (
        <div className="bg-white border border-gray-300 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-300 bg-gray-50 text-gray-600">
                  <th className="px-3 py-2 text-left text-[10.5px] font-bold uppercase border-r border-gray-200 w-12">Sr.No.</th>
                  <th className="px-3 py-2 text-left text-[10.5px] font-bold uppercase border-r border-gray-200">Student Name</th>
                  <th className="px-3 py-2 text-left text-[10.5px] font-bold uppercase border-r border-gray-200 w-36">Olympiad ID</th>
                  <th className="px-3 py-2 text-left text-[10.5px] font-bold uppercase border-r border-gray-200 w-24">Class</th>
                  <th className="px-3 py-2 text-left text-[10.5px] font-bold uppercase border-r border-gray-200 w-32">Phone</th>
                  <th className="px-3 py-2 text-left text-[10.5px] font-bold uppercase border-r border-gray-200 w-28">Joined On</th>
                  <th className="px-3 py-2 text-center text-[10.5px] font-bold uppercase border-r border-gray-200 w-20">Videos</th>
                  <th className="px-3 py-2 text-center text-[10.5px] font-bold uppercase border-r border-gray-200 w-24">Status</th>
                  <th className="px-3 py-2 text-center text-[10.5px] font-bold uppercase w-20">Via</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, i) => (
                  <tr key={s.id} className={`border-b border-gray-200 hover:bg-gray-50 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'}`}>
                    <td className="px-3 py-2 text-gray-500 text-xs border-r border-gray-100">{i + 1}</td>
                    <td className="px-3 py-2 border-r border-gray-100">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 border border-gray-300 bg-[#F4F5F7] text-[#06013E] text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                          {getInitials(s.name)}
                        </div>
                        <span className="font-medium text-gray-800 text-sm">{s.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs font-semibold text-[#06013E] border-r border-gray-100">{s.olympiadCode}</td>
                    <td className="px-3 py-2 border-r border-gray-100">
                      {s.className || s.classCode ? (
                        <span className="text-xs text-gray-700">{s.className || s.classCode}</span>
                      ) : <span className="text-gray-400 text-xs">-</span>}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-600 font-mono border-r border-gray-100">{s.phone}</td>
                    <td className="px-3 py-2 text-xs text-gray-600 border-r border-gray-100">
                      {new Date(s.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-3 py-2 text-center border-r border-gray-100">
                      {(() => {
                        const count = s.olympiadVideos ?? 0;
                        return (
                          <span className="text-xs font-semibold text-gray-700 font-mono">{count}/2</span>
                        );
                      })()}
                    </td>
                    <td className="px-3 py-2 text-center border-r border-gray-100">
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold text-green-700 border border-green-300 bg-green-50">
                        VERIFIED
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      {s.source === 'app'
                        ? <span className="text-[10px] font-bold text-gray-600">APP</span>
                        : <span className="text-[10px] font-bold text-gray-600">WEB</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 border-t border-gray-300 flex justify-between items-center text-[11px] text-gray-500">
            <span>Showing <span className="font-semibold text-gray-700">{filtered.length}</span> of <span className="font-semibold text-gray-700">{students.length}</span> students</span>
            <span>Mittsure Technologies — Olympiad Portal</span>
          </div>
        </div>
      ) : (
        /* Cards View */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((s) => (
            <div key={s.id} className="bg-white border border-gray-300 hover:border-gray-400 transition-colors p-4 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 border border-gray-300 bg-[#F4F5F7] text-[#06013E] text-sm font-bold flex items-center justify-center flex-shrink-0">
                  {getInitials(s.name)}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-gray-900 truncate">{s.name}</p>
                  <p className="font-mono text-xs text-gray-500">{s.olympiadCode}</p>
                </div>
                <div className="ml-auto flex flex-col items-end gap-1 flex-shrink-0">
                  <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 text-green-700 border border-green-300 bg-green-50">
                    VERIFIED
                  </span>
                  <span className="text-[10px] font-bold text-gray-500">{s.source === 'app' ? 'APP' : 'WEB'}</span>
                </div>
              </div>
              <div className="flex flex-col gap-1.5 text-xs text-gray-600">
                {(s.className || s.classCode) && (
                  <div className="flex items-center gap-2">
                    <BookOpen size={11} className="text-gray-400 flex-shrink-0" />
                    <span>{s.className || s.classCode}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Phone size={11} className="text-gray-400 flex-shrink-0" />
                  <span className="font-mono">{s.phone}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar size={11} className="text-gray-400 flex-shrink-0" />
                  <span>{new Date(s.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Award size={11} className="text-gray-400 flex-shrink-0" />
                  <span>{s.olympiadVideos ?? 0}/2 videos uploaded</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
