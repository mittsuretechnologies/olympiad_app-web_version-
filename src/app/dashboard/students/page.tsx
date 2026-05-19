'use client';

import { useEffect, useMemo, useState } from 'react';
import { GraduationCap, Loader2, Search, Download } from 'lucide-react';

interface Student {
  id: string;
  name: string;
  phone: string;
  isVerified: boolean;
  createdAt: string;
  allocation: {
    code: string;
    sentAt?: string | null;
    school: {
      schoolId: string;
      name: string;
      city?: string | null;
      state?: string | null;
    };
  };
}

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [schoolFilter, setSchoolFilter] = useState('ALL');

  useEffect(() => {
    fetch('/api/students')
      .then((r) => r.json())
      .then((data) => setStudents(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, []);

  const schools = useMemo(() => {
    const map = new Map<string, string>();
    students.forEach((s) => map.set(s.allocation.school.schoolId, s.allocation.school.name));
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [students]);

  const filtered = useMemo(() => {
    return students.filter((s) => {
      if (schoolFilter !== 'ALL' && s.allocation.school.schoolId !== schoolFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !s.name.toLowerCase().includes(q) &&
          !s.phone.includes(q) &&
          !s.allocation.code.toLowerCase().includes(q) &&
          !s.allocation.school.name.toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [students, search, schoolFilter]);

  const exportCSV = () => {
    if (filtered.length === 0) return;
    const rows = [
      ['#', 'Olympiad ID', 'Student Name', 'Phone', 'School ID', 'School Name', 'Location', 'Registered On'],
      ...filtered.map((s, i) => [
        i + 1,
        s.allocation.code,
        s.name,
        s.phone,
        s.allocation.school.schoolId,
        s.allocation.school.name,
        [s.allocation.school.city, s.allocation.school.state].filter(Boolean).join(', ') || '-',
        new Date(s.createdAt).toLocaleDateString(),
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `registered-students.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white border border-gray-300 shadow-sm">
      <div className="bg-[#06013E] text-white px-6 py-3 flex items-center justify-between border-b-4 border-[#FF9000]">
        <div className="flex items-center gap-3">
          <GraduationCap size={20} />
          <h1 className="text-base font-bold uppercase tracking-wider">Registered Students</h1>
        </div>
        <div className="text-xs text-gray-300">Students who registered via the Talent App</div>
      </div>

      <div className="bg-gray-50 border-b border-gray-300 px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4 text-sm">
          <span><span className="text-gray-600">Total: </span><span className="font-bold text-[#06013E]">{students.length}</span></span>
          <span><span className="text-gray-600">Showing: </span><span className="font-bold text-[#06013E]">{filtered.length}</span></span>
        </div>
        <button onClick={exportCSV} disabled={filtered.length === 0}
          className="inline-flex items-center gap-2 bg-[#06013E] text-white px-4 py-2 text-sm font-semibold hover:bg-[#0a0660] disabled:opacity-50">
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      <div className="px-6 py-3 border-b border-gray-300 bg-white flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input type="text" placeholder="Search by name, phone, Olympiad ID, school..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 text-sm focus:outline-none focus:border-[#06013E] focus:ring-1 focus:ring-[#06013E]"
          />
        </div>
        <select value={schoolFilter} onChange={(e) => setSchoolFilter(e.target.value)}
          className="h-9 border border-gray-300 px-3 text-sm focus:outline-none focus:border-[#06013E] focus:ring-1 focus:ring-[#06013E]">
          <option value="ALL">All Schools</option>
          {schools.map((s) => (
            <option key={s.id} value={s.id}>{s.id} — {s.name}</option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-[#E8EAF6] border-b-2 border-[#06013E] text-[#06013E]">
              <th className="px-4 py-3 text-left text-xs font-bold uppercase border-r border-gray-300 w-12">#</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase border-r border-gray-300">Olympiad ID</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase border-r border-gray-300">Student Name</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase border-r border-gray-300">Phone</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase border-r border-gray-300">School</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase border-r border-gray-300">Location</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase">Registered On</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="py-16 text-center">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#06013E] mb-2" />
                <p className="text-gray-600 text-sm">Loading students...</p>
              </td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="py-16 text-center text-gray-500 text-sm">
                {students.length === 0
                  ? 'No students registered yet via the app.'
                  : 'No records match your filters.'}
              </td></tr>
            ) : (
              filtered.map((s, idx) => (
                <tr key={s.id} className={`border-b border-gray-200 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-yellow-50`}>
                  <td className="px-4 py-2.5 border-r border-gray-200 text-gray-700 text-xs">{idx + 1}</td>
                  <td className="px-4 py-2.5 border-r border-gray-200 font-mono font-semibold text-[#06013E]">{s.allocation.code}</td>
                  <td className="px-4 py-2.5 border-r border-gray-200 font-semibold text-gray-900">{s.name}</td>
                  <td className="px-4 py-2.5 border-r border-gray-200 font-mono text-gray-800 text-xs">{s.phone}</td>
                  <td className="px-4 py-2.5 border-r border-gray-200">
                    <div className="text-xs font-mono text-[#06013E] font-semibold">{s.allocation.school.schoolId}</div>
                    <div className="text-xs text-gray-600">{s.allocation.school.name}</div>
                  </td>
                  <td className="px-4 py-2.5 border-r border-gray-200 text-gray-700 text-xs">
                    {[s.allocation.school.city, s.allocation.school.state].filter(Boolean).join(', ') || '-'}
                  </td>
                  <td className="px-4 py-2.5 text-gray-700 text-xs">
                    {new Date(s.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="bg-gray-50 border-t border-gray-300 px-6 py-2 text-xs text-gray-600 flex justify-between items-center">
        <span>Showing <span className="font-bold">{filtered.length}</span> of <span className="font-bold">{students.length}</span> students</span>
        <span className="italic">© Mittsure Olympiad Portal</span>
      </div>
    </div>
  );
}
