'use client';

import { useEffect, useMemo, useState } from 'react';
import { Users, Loader2, Search, Download, CheckCircle2 } from 'lucide-react';

interface Student {
  id: string;
  name: string;
  phone: string;
  olympiadCode: string;
  isVerified: boolean;
  createdAt: string;
}

export default function SchoolRegisteredStudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

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

  const filtered = useMemo(() => {
    return students.filter((s) => {
      if (search && !(
        s.name.toLowerCase().includes(search.toLowerCase()) || 
        s.olympiadCode.toLowerCase().includes(search.toLowerCase()) ||
        s.phone.includes(search)
      )) return false;
      return true;
    });
  }, [students, search]);

  const exportCSV = () => {
    if (filtered.length === 0) return;
    const rows = [
      ['#', 'Student Name', 'Olympiad ID', 'Phone', 'Registration Date'],
      ...filtered.map((s, i) => [
        i + 1,
        s.name,
        s.olympiadCode,
        s.phone,
        new Date(s.createdAt).toLocaleDateString('en-IN'),
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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-gray-500">
        <Loader2 className="animate-spin mb-2" size={32} />
        <p>Loading student records...</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-300 shadow-sm">
      <div className="bg-[#06013E] text-white px-6 py-3 flex items-center justify-between border-b-4 border-[#FF9000]">
        <div className="flex items-center gap-3">
          <Users size={20} />
          <h1 className="text-base font-bold uppercase tracking-wider">My Registered Students</h1>
        </div>
        <div className="text-xs text-gray-300">Students who joined via the Mobile App</div>
      </div>

      <div className="bg-gray-50 border-b border-gray-300 px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4 text-sm">
          <span><span className="text-gray-600">Total Registered: </span><span className="font-bold text-[#06013E]">{students.length}</span></span>
        </div>
        <button
          onClick={exportCSV}
          disabled={filtered.length === 0}
          className="inline-flex items-center gap-2 bg-[#06013E] text-white px-4 py-2 text-sm font-semibold hover:bg-[#0a0660] disabled:opacity-50"
        >
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      <div className="px-6 py-3 border-b border-gray-300 bg-white flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Search by Name, ID or Phone..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 text-sm focus:outline-none focus:ring-1 focus:ring-[#06013E]"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-300">
              <th className="px-6 py-3 text-[10px] font-bold uppercase text-gray-600 w-12 text-center">#</th>
              <th className="px-6 py-3 text-[10px] font-bold uppercase text-gray-600">Student Name</th>
              <th className="px-6 py-3 text-[10px] font-bold uppercase text-gray-600">Olympiad ID (Roll No.)</th>
              <th className="px-6 py-3 text-[10px] font-bold uppercase text-gray-600">Phone Number</th>
              <th className="px-6 py-3 text-[10px] font-bold uppercase text-gray-600">Status</th>
              <th className="px-6 py-3 text-[10px] font-bold uppercase text-gray-600">Joined On</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s, i) => (
              <tr key={s.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 text-sm text-gray-400 text-center font-mono">{i + 1}</td>
                <td className="px-6 py-4">
                  <span className="text-sm font-bold text-[#06013E]">{s.name}</span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm font-mono font-semibold text-gray-700">{s.olympiadCode}</span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">{s.phone}</td>
                <td className="px-6 py-4">
                  <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-green-50 text-green-700 border border-green-200 text-[10px] font-bold uppercase">
                    <CheckCircle2 size={10} /> Verified
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {new Date(s.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-gray-400 text-sm">
                  {search ? 'No students match your search.' : 'No students have registered yet via the app.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="px-6 py-3 bg-gray-50 text-[10px] text-gray-400 flex justify-between items-center border-t border-gray-300">
        <p>Showing {filtered.length} of {students.length} Students</p>
        <p>© Mittsure Olympiad Portal</p>
      </div>
    </div>
  );
}
