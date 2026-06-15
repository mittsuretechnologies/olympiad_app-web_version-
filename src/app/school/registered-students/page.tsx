'use client';

import { useEffect, useMemo, useState } from 'react';
import { Users, Loader2, Search, Download, CheckCircle2, BookOpen, Calendar, Phone } from 'lucide-react';

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

  const avatarColors = [
    'bg-blue-600', 'bg-purple-600', 'bg-green-600',
    'bg-rose-600', 'bg-orange-600', 'bg-teal-600',
  ];

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="bg-[#06013E] text-white px-6 py-3 flex items-center justify-between border-b-4 border-[#FF9000]">
          <div className="flex items-center gap-3">
            <Users size={18} />
            <h1 className="text-sm font-bold uppercase tracking-wider">My Registered Students</h1>
          </div>
          <button
            onClick={exportCSV}
            disabled={filtered.length === 0}
            className="inline-flex items-center gap-1.5 bg-[#FF9000] text-[#06013E] px-3 py-1.5 text-xs font-bold hover:bg-amber-400 transition-colors disabled:opacity-40"
          >
            <Download size={13} /> Export CSV
          </button>
        </div>

        {/* Stats Bar */}
        <div className="flex flex-wrap divide-x divide-gray-100 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center gap-2 px-5 py-3">
            <CheckCircle2 size={14} className="text-green-600" />
            <span className="text-xl font-black text-green-700">{students.length}</span>
            <span className="text-xs text-gray-400">Total Registered</span>
          </div>
          {classes.map(cls => {
            const count = students.filter(s => (s.classCode || 'UNKNOWN') === cls.code).length;
            return (
              <div key={cls.code} className="flex items-center gap-2 px-5 py-3">
                <BookOpen size={13} className="text-[#06013E]/50" />
                <span className="text-lg font-black text-[#06013E]">{count}</span>
                <span className="text-xs text-gray-400">{cls.name}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filters & View Toggle */}
      <div className="bg-white border border-gray-200 shadow-sm px-5 py-3 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
          <input
            type="text"
            placeholder="Search by name, ID or phone..."
            className="w-full pl-8 pr-3 py-2 border border-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-[#06013E] focus:border-[#06013E]"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {classes.length > 1 && (
          <div className="flex items-center border border-gray-200 overflow-hidden">
            <button
              onClick={() => setClassFilter('ALL')}
              className={`px-3 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors ${classFilter === 'ALL' ? 'bg-[#06013E] text-white' : 'text-gray-500 hover:bg-gray-50'}`}
            >All</button>
            {classes.map(cls => (
              <button key={cls.code} onClick={() => setClassFilter(cls.code)}
                className={`px-3 py-2 text-[10px] font-bold uppercase tracking-wider border-l border-gray-200 transition-colors ${classFilter === cls.code ? 'bg-[#06013E] text-white' : 'text-gray-500 hover:bg-gray-50'}`}
              >{cls.name}</button>
            ))}
          </div>
        )}

        <div className="ml-auto flex items-center border border-gray-200 overflow-hidden">
          <button onClick={() => setView('table')}
            className={`px-3 py-2 text-[10px] font-bold uppercase transition-colors ${view === 'table' ? 'bg-[#06013E] text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
            Table
          </button>
          <button onClick={() => setView('cards')}
            className={`px-3 py-2 text-[10px] font-bold uppercase border-l border-gray-200 transition-colors ${view === 'cards' ? 'bg-[#06013E] text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
            Cards
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="bg-white border border-gray-200 py-20 flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-[#06013E]" />
          <p className="text-sm text-gray-400">Loading student records...</p>
        </div>
      ) : error ? (
        <div className="bg-white border border-red-200 py-16 text-center text-red-600 text-sm">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-gray-200 py-20 text-center">
          <Users size={36} className="mx-auto text-gray-200 mb-3" />
          <p className="text-gray-400 text-sm">
            {students.length === 0 ? 'No students have registered yet via the app.' : 'No students match your filters.'}
          </p>
        </div>
      ) : view === 'table' ? (
        <div className="bg-white border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-[#E8EAF6] border-b-2 border-[#06013E] text-[#06013E]">
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase w-10">#</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase">Student</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase">Olympiad ID</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase">Class</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase">Phone</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase">Joined On</th>
                  <th className="px-4 py-3 text-center text-[10px] font-bold uppercase">Status</th>
                  <th className="px-4 py-3 text-center text-[10px] font-bold uppercase">Via</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, i) => (
                  <tr key={s.id} className={`border-b border-gray-100 hover:bg-blue-50/30 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}>
                    <td className="px-4 py-3 text-gray-400 text-xs">{i + 1}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-7 h-7 rounded-full ${avatarColors[i % avatarColors.length]} text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0`}>
                          {getInitials(s.name)}
                        </div>
                        <span className="font-semibold text-[#06013E] text-sm">{s.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs font-bold text-gray-700">{s.olympiadCode}</td>
                    <td className="px-4 py-3">
                      {s.className || s.classCode ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 bg-[#E8EAF6] text-[#06013E] rounded">
                          <BookOpen size={8} /> {s.className || s.classCode}
                        </span>
                      ) : <span className="text-gray-300 text-xs">-</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 font-mono">{s.phone}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {new Date(s.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold bg-green-50 text-green-700 border border-green-200 rounded">
                        <CheckCircle2 size={9} /> Verified
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {s.source === 'app'
                        ? <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 rounded">App</span>
                        : <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 rounded">Web</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-2.5 border-t border-gray-100 flex justify-between items-center text-xs text-gray-400">
            <span>Showing <span className="font-semibold text-gray-600">{filtered.length}</span> of <span className="font-semibold text-gray-600">{students.length}</span> students</span>
            <span className="italic">© Mittsure Olympiad Portal</span>
          </div>
        </div>
      ) : (
        /* Cards View */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((s, i) => (
            <div key={s.id} className="bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-4 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full ${avatarColors[i % avatarColors.length]} text-white text-sm font-bold flex items-center justify-center flex-shrink-0`}>
                  {getInitials(s.name)}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-[#06013E] truncate">{s.name}</p>
                  <p className="font-mono text-xs text-gray-400">{s.olympiadCode}</p>
                </div>
                <div className="ml-auto flex flex-col items-end gap-1 flex-shrink-0">
                  <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 bg-green-50 text-green-700 border border-green-200 rounded">
                    <CheckCircle2 size={8} /> Verified
                  </span>
                  {s.source === 'app'
                    ? <span className="text-[9px] font-bold px-1.5 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded">App</span>
                    : <span className="text-[9px] font-bold px-1.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded">Web</span>
                  }
                </div>
              </div>
              <div className="flex flex-col gap-1.5 text-xs text-gray-500">
                {(s.className || s.classCode) && (
                  <div className="flex items-center gap-2">
                    <BookOpen size={11} className="text-[#06013E]/40 flex-shrink-0" />
                    <span>{s.className || s.classCode}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Phone size={11} className="text-[#06013E]/40 flex-shrink-0" />
                  <span className="font-mono">{s.phone}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar size={11} className="text-[#06013E]/40 flex-shrink-0" />
                  <span>{new Date(s.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
