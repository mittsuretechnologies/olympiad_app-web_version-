'use client';

import { useEffect, useMemo, useState } from 'react';
import { Eye, Loader2, Search } from 'lucide-react';

interface ViewerCred {
  id:        string;
  email:     string;
  name:      string | null;
  createdAt: string;
  updatedAt: string;
}

export default function ViewerCredentialsPage() {
  const [rows,    setRows]    = useState<ViewerCred[]>([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');

  useEffect(() => {
    fetch('/api/credentials/viewers')
      .then((r) => r.json())
      .then((d) => setRows(Array.isArray(d) ? d : []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!search) return rows;
    const q = search.toLowerCase();
    return rows.filter(
      (r) =>
        r.email?.toLowerCase().includes(q) ||
        (r.name ?? '').toLowerCase().includes(q)
    );
  }, [rows, search]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-medium text-[#004f9f]">Viewer App Accounts</h1>
    <div className="bg-white border border-gray-300 shadow-sm">
      {/* Toolbar */}
      <div className="bg-gray-50 border-b border-gray-300 px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm">
          <span className="text-gray-600">Total Viewers: </span>
          <span className="font-bold text-[#004f9f]">{rows.length}</span>
        </div>
        <div className="relative max-w-md flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 text-sm focus:outline-none focus:border-[#06013E] focus:ring-1 focus:ring-[#06013E]"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-[#E8EAF6] border-b-2 border-[#06013E] text-[#004f9f]">
              <th className="px-4 py-3 text-left text-xs font-bold uppercase border-r border-gray-300 w-12">#</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase border-r border-gray-300">Name</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase border-r border-gray-300">Email (Login)</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase border-r border-gray-300">Password</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase border-r border-gray-300">Joined</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase">Last Updated</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="py-16 text-center">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#004f9f] mb-2" />
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-16 text-center text-gray-500 text-sm">
                  {rows.length === 0 ? 'No viewers have signed up yet.' : 'No matches.'}
                </td>
              </tr>
            ) : (
              filtered.map((r, idx) => (
                <tr
                  key={r.id}
                  className={`border-b border-gray-200 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-yellow-50`}
                >
                  <td className="px-4 py-2.5 border-r border-gray-200 text-xs">{idx + 1}</td>
                  <td className="px-4 py-2.5 border-r border-gray-200 font-semibold text-gray-900">
                    {r.name ?? <span className="text-gray-400 italic">—</span>}
                  </td>
                  <td className="px-4 py-2.5 border-r border-gray-200 font-mono text-[#004f9f]">{r.email}</td>
                  <td className="px-4 py-2.5 border-r border-gray-200 text-gray-500 italic text-xs">
                    Set by viewer on signup
                  </td>
                  <td className="px-4 py-2.5 border-r border-gray-200 text-xs">
                    {new Date(r.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2.5 text-xs">
                    {new Date(r.updatedAt).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="bg-gray-50 border-t border-gray-300 px-6 py-2 text-xs text-gray-200 flex justify-between items-center">
        <span>
          Showing <span className="font-bold">{filtered.length}</span> of{' '}
          <span className="font-bold">{rows.length}</span>
        </span>
        <span className="italic">Â© Mittsure Olympiad Portal</span>
      </div>
    </div>
    </div>
  );
}

