'use client';

import { useEffect, useMemo, useState } from 'react';
import { Smartphone, Loader2, Search, CheckCircle, XCircle, GraduationCap } from 'lucide-react';

interface AppUser {
  id: string;
  userId: string;
  email: string | null;
  mobile: string | null;
  olympiadId: string | null;
  isVerified: boolean;
  termsAccepted: boolean;
  plainPassword: string | null;
  createdAt: string;
}

export default function AppUsersPage() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/app/users')
      .then((r) => r.json())
      .then((data) => setUsers(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!search) return users;
    const q = search.toLowerCase();
    return users.filter(
      (u) =>
        u.userId.toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (u.mobile || '').includes(q) ||
        (u.olympiadId || '').toLowerCase().includes(q)
    );
  }, [users, search]);

  return (
    <div className="bg-white border border-gray-300 shadow-sm">
      <div className="bg-[#06013E] text-white px-6 py-3 flex items-center justify-between border-b-4 border-[#FF9000]">
        <div className="flex items-center gap-3">
          <Smartphone size={20} />
          <h1 className="text-base font-bold uppercase tracking-wider">App Users</h1>
        </div>
        <div className="text-xs text-gray-300">All registered mobile app users</div>
      </div>

      <div className="bg-gray-50 border-b border-gray-300 px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm">
          <span className="text-gray-600">Total Users: </span>
          <span className="font-bold text-[#06013E]">{users.length}</span>
        </div>
        <div className="relative max-w-md flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Search by User ID, email, mobile..."
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
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider border-r border-gray-300">User ID</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider border-r border-gray-300">Role</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider border-r border-gray-300">Email</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider border-r border-gray-300">Mobile</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider border-r border-gray-300">Olympiad ID</th>
              <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider border-r border-gray-300">Verified</th>
              <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider border-r border-gray-300">T&C</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider border-r border-gray-300">Password</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Registered</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={10} className="py-16 text-center">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#06013E] mb-2" />
                  <p className="text-gray-600 text-sm">Loading users...</p>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-16 text-center text-gray-500 text-sm">
                  {users.length === 0 ? 'No app users registered yet.' : 'No users match your search.'}
                </td>
              </tr>
            ) : (
              filtered.map((u, idx) => (
                <tr
                  key={u.id}
                  className={`border-b border-gray-200 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-yellow-50 transition-colors`}
                >
                  <td className="px-4 py-2.5 border-r border-gray-200 text-gray-700 text-xs">{idx + 1}</td>
                  <td className="px-4 py-2.5 border-r border-gray-200 font-mono font-bold text-[#06013E]">{u.userId}</td>
                  <td className="px-4 py-2.5 border-r border-gray-200">
                    {u.olympiadId ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase bg-amber-50 text-amber-700 border border-amber-300">
                        <GraduationCap className="w-3 h-3" /> Student
                      </span>
                    ) : (
                      <span className="inline-block px-2 py-0.5 text-[10px] font-bold uppercase bg-blue-50 text-blue-700 border border-blue-200">
                        Viewer
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 border-r border-gray-200 text-gray-700 text-xs">{u.email || <span className="text-gray-400">—</span>}</td>
                  <td className="px-4 py-2.5 border-r border-gray-200 text-gray-700 text-xs font-mono">{u.mobile || <span className="text-gray-400">—</span>}</td>
                  <td className="px-4 py-2.5 border-r border-gray-200 text-xs">
                    {u.olympiadId
                      ? <span className="font-mono font-semibold text-amber-700">{u.olympiadId}</span>
                      : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-2.5 border-r border-gray-200 text-center">
                    {u.isVerified
                      ? <CheckCircle className="w-4 h-4 text-green-600 mx-auto" />
                      : <XCircle className="w-4 h-4 text-gray-400 mx-auto" />}
                  </td>
                  <td className="px-4 py-2.5 border-r border-gray-200 text-center">
                    {u.termsAccepted
                      ? <CheckCircle className="w-4 h-4 text-green-600 mx-auto" />
                      : <XCircle className="w-4 h-4 text-gray-400 mx-auto" />}
                  </td>
                  <td className="px-4 py-2.5 border-r border-gray-200 text-xs font-mono">
                    {u.plainPassword
                      ? <span className="text-gray-800 font-semibold">{u.plainPassword}</span>
                      : <span className="text-gray-400 italic">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-gray-700 text-xs">
                    {new Date(u.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="bg-gray-50 border-t border-gray-300 px-6 py-2 text-xs text-gray-600 flex justify-between items-center">
        <span className="flex items-center gap-4">
          <span>
            Showing <span className="font-bold">{filtered.length}</span> of{' '}
            <span className="font-bold">{users.length}</span> users
          </span>
          <span className="text-amber-700 font-semibold">
            Students: {users.filter(u => u.olympiadId).length}
          </span>
          <span className="text-blue-700 font-semibold">
            Viewers: {users.filter(u => !u.olympiadId).length}
          </span>
        </span>
        <span className="italic">© Mittsure Olympiad Portal</span>
      </div>
    </div>
  );
}
