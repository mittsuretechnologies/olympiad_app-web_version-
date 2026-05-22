'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Search, UserCheck } from 'lucide-react';

interface StudentCred {
  id: string;
  name: string;
  phone: string;
  olympiadCode: string;
  isVerified: boolean;
  createdAt: string;
  school: {
    id: string;
    schoolId: string;
    name: string;
    city: string | null;
  } | null;
}

export default function StudentCredentialsPage() {
  const [rows, setRows] = useState<StudentCred[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/credentials/students')
      .then((res) => res.json())
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!search) return rows;
    const q = search.toLowerCase();
    return rows.filter(
      (r) =>
        r.name?.toLowerCase().includes(q) ||
        r.olympiadCode?.toLowerCase().includes(q) ||
        r.phone?.toLowerCase().includes(q) ||
        r.school?.name?.toLowerCase().includes(q) ||
        r.school?.schoolId?.toLowerCase().includes(q) ||
        r.school?.city?.toLowerCase().includes(q)
    );
  }, [rows, search]);

  return (
    <div className="bg-white border border-gray-300 shadow-sm">
      <div className="bg-[#06013E] text-white px-6 py-3 flex items-center justify-between border-b-4 border-[#FF9000]">
        <div className="flex items-center gap-3">
          <UserCheck size={20} />
          <h1 className="text-base font-bold uppercase tracking-wider">Manage Student Credentials</h1>
        </div>
        <div className="text-xs text-gray-300">View registered student profiles and verification status</div>
      </div>

      <div className="bg-gray-50 border-b border-gray-300 px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm">
          <span className="text-gray-600">Total Registered Students: </span>
          <span className="font-bold text-[#06013E]">{rows.length}</span>
        </div>
        <div className="relative max-w-md flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Search by student name, Olympiad ID, phone, school..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 text-sm focus:outline-none focus:border-[#06013E] focus:ring-1 focus:ring-[#06013E]"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-[#E8EAF6] border-b-2 border-[#06013E] text-[#06013E]">
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider border-r border-gray-300 w-12">#</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider border-r border-gray-300">Olympiad ID (Username)</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider border-r border-gray-300">Student Name</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider border-r border-gray-300">Phone Number</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider border-r border-gray-300">School ID & Name</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider border-r border-gray-300">City</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider border-r border-gray-300">Status</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Registration Date</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="py-16 text-center">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#06013E] mb-2" />
                  <p className="text-gray-600 text-sm">Loading credentials...</p>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-16 text-center text-gray-500 text-sm">
                  {rows.length === 0
                    ? 'No students registered yet.'
                    : 'No students match your search.'}
                </td>
              </tr>
            ) : (
              filtered.map((r, idx) => (
                <tr
                  key={r.id}
                  className={`border-b border-gray-200 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-yellow-50 transition-colors`}
                >
                  <td className="px-4 py-2.5 border-r border-gray-200 text-gray-700 text-xs">{idx + 1}</td>
                  <td className="px-4 py-2.5 border-r border-gray-200 font-mono font-semibold text-[#06013E] select-all">{r.olympiadCode}</td>
                  <td className="px-4 py-2.5 border-r border-gray-200 font-semibold text-gray-900">{r.name}</td>
                  <td className="px-4 py-2.5 border-r border-gray-200 font-mono text-gray-800">{r.phone}</td>
                  <td className="px-4 py-2.5 border-r border-gray-200">
                    {r.school ? (
                      <div>
                        <span className="font-mono text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded mr-1">
                          {r.school.schoolId}
                        </span>
                        <span className="font-semibold text-gray-800">{r.school.name}</span>
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 border-r border-gray-200 text-gray-700 text-xs">{r.school?.city || '-'}</td>
                  <td className="px-4 py-2.5 border-r border-gray-200">
                    {r.isVerified ? (
                      <span className="inline-flex items-center text-xs font-bold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                        Verified
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-xs font-bold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                        Pending Verification
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-gray-700 text-xs">
                    {new Date(r.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="bg-gray-50 border-t border-gray-300 px-6 py-2 text-xs text-gray-600 flex justify-between items-center">
        <span>
          Showing <span className="font-bold">{filtered.length}</span> of{' '}
          <span className="font-bold">{rows.length}</span> students
        </span>
        <span className="italic">© Mittsure Olympiad Portal</span>
      </div>
    </div>
  );
}
