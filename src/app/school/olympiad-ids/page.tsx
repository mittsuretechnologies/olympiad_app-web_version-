'use client';

import { useEffect, useMemo, useState } from 'react';
import { Hash, Loader2, Search, Download } from 'lucide-react';

interface Allocation {
  id: string;
  code: string;
  status: string;
  sentAt?: string | null;
  createdAt: string;
}

export default function SchoolOlympiadIdsPage() {
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'SENT' | 'PENDING'>('ALL');

  useEffect(() => {
    const token = localStorage.getItem('schoolToken');
    if (!token) { setError('Not logged in'); setLoading(false); return; }

    fetch('/api/school/me/olympiad-ids', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to load');
        setAllocations(Array.isArray(data) ? data : []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return allocations.filter((a) => {
      if (statusFilter === 'SENT' && !a.sentAt) return false;
      if (statusFilter === 'PENDING' && a.sentAt) return false;
      if (search && !a.code.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [allocations, search, statusFilter]);

  const stats = useMemo(() => ({
    total: allocations.length,
    sent: allocations.filter((a) => a.sentAt).length,
    pending: allocations.filter((a) => !a.sentAt).length,
  }), [allocations]);

  const exportCSV = () => {
    if (filtered.length === 0) return;
    const rows = [
      ['#', 'Olympiad ID', 'Status', 'Delivery'],
      ...filtered.map((a, i) => [
        i + 1,
        a.code,
        a.status,
        a.sentAt ? 'Sent' : 'Pending',
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `olympiad-ids.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white border border-gray-300 shadow-sm">
      <div className="bg-[#06013E] text-white px-6 py-3 flex items-center justify-between border-b-4 border-[#FF9000]">
        <div className="flex items-center gap-3">
          <Hash size={20} />
          <h1 className="text-base font-bold uppercase tracking-wider">Allocated Olympiad IDs</h1>
        </div>
        <div className="text-xs text-gray-300">Your school's roll numbers to distribute to students</div>
      </div>

      <div className="bg-gray-50 border-b border-gray-300 px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4 text-sm">
          <span><span className="text-gray-600">Total: </span><span className="font-bold text-[#06013E]">{stats.total}</span></span>
          <span><span className="text-gray-600">Delivered: </span><span className="font-bold text-green-700">{stats.sent}</span></span>
          <span><span className="text-gray-600">Pending: </span><span className="font-bold text-orange-700">{stats.pending}</span></span>
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
            placeholder="Search by Olympiad ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 text-sm focus:outline-none focus:border-[#06013E] focus:ring-1 focus:ring-[#06013E]"
          />
        </div>
        <div className="flex items-center gap-1 border border-gray-300">
          {(['ALL', 'SENT', 'PENDING'] as const).map((s) => (
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
              <th className="px-4 py-3 text-left text-xs font-bold uppercase border-r border-gray-300 w-12">#</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase border-r border-gray-300">Olympiad ID (Roll No.)</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase border-r border-gray-300">Delivery Status</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase">Delivered On</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="py-16 text-center">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#06013E] mb-2" />
                <p className="text-gray-600 text-sm">Loading IDs...</p>
              </td></tr>
            ) : error ? (
              <tr><td colSpan={4} className="py-16 text-center text-red-600 text-sm">{error}</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={4} className="py-16 text-center text-gray-500 text-sm">
                {allocations.length === 0
                  ? 'No Olympiad IDs allocated yet. Please contact your Mittsure coordinator.'
                  : 'No records match your filters.'}
              </td></tr>
            ) : (
              filtered.map((a, idx) => (
                <tr key={a.id} className={`border-b border-gray-200 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                  <td className="px-4 py-2.5 border-r border-gray-200 text-gray-700 text-xs">{idx + 1}</td>
                  <td className="px-4 py-2.5 border-r border-gray-200 font-mono font-semibold text-[#06013E]">{a.code}</td>
                  <td className="px-4 py-2.5 border-r border-gray-200">
                    <span className={`inline-block px-2 py-0.5 text-[10px] font-bold uppercase ${
                      a.sentAt
                        ? 'bg-green-100 text-green-800 border border-green-300'
                        : 'bg-orange-100 text-orange-800 border border-orange-300'
                    }`}>
                      {a.sentAt ? 'Delivered' : 'Pending'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-gray-700 text-xs">
                    {a.sentAt ? new Date(a.sentAt).toLocaleDateString() : '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="bg-gray-50 border-t border-gray-300 px-6 py-2 text-xs text-gray-600 flex justify-between items-center">
        <span>Showing <span className="font-bold">{filtered.length}</span> of <span className="font-bold">{allocations.length}</span> IDs</span>
        <span className="italic">© Mittsure Olympiad Portal</span>
      </div>
    </div>
  );
}
