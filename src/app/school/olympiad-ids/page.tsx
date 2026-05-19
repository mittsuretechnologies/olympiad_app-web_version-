'use client';

import { useEffect, useMemo, useState } from 'react';
import { Hash, Loader2, Search, Download, UserPlus, Edit } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Allocation {
  id: string;
  code: string;
  prefix: string;
  sequence: number;
  status: string;
  studentName?: string | null;
  studentPhone?: string | null;
  assignedAt?: string | null;
  createdAt: string;
}

export default function SchoolOlympiadIdsPage() {
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UNASSIGNED' | 'ASSIGNED'>('ALL');

  const [editing, setEditing] = useState<Allocation | null>(null);
  const [studentName, setStudentName] = useState('');
  const [studentPhone, setStudentPhone] = useState('');
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const loadAllocations = () => {
    const token = localStorage.getItem('schoolToken');
    if (!token) {
      setError('Not logged in');
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch('/api/school/me/olympiad-ids', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to load IDs');
        setAllocations(Array.isArray(data) ? data : []);
        setError(null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadAllocations();
  }, []);

  const filtered = useMemo(() => {
    return allocations.filter((a) => {
      if (statusFilter !== 'ALL' && a.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !a.code.toLowerCase().includes(q) &&
          !(a.studentName || '').toLowerCase().includes(q) &&
          !(a.studentPhone || '').toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [allocations, search, statusFilter]);

  const stats = useMemo(() => {
    const total = allocations.length;
    const assigned = allocations.filter((a) => a.status === 'ASSIGNED').length;
    return { total, assigned, unassigned: total - assigned };
  }, [allocations]);

  const exportCSV = () => {
    if (filtered.length === 0) return;
    const rows = [
      ['Olympiad ID', 'Student Name', 'Phone', 'Status'],
      ...filtered.map((a) => [
        a.code,
        a.studentName || '',
        a.studentPhone || '',
        a.status,
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

  const openAssignModal = (a: Allocation) => {
    setEditing(a);
    setStudentName(a.studentName || '');
    setStudentPhone(a.studentPhone || '');
    setSaveError(null);
  };

  const handleSaveAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setSaveError(null);

    if (!studentName.trim() || !studentPhone.trim()) {
      setSaveError('Both student name and phone are required.');
      return;
    }
    if (!/^\d{10}$/.test(studentPhone.trim())) {
      setSaveError('Phone must be a 10-digit number.');
      return;
    }

    setSaveBusy(true);
    try {
      const token = localStorage.getItem('schoolToken');
      const res = await fetch(`/api/school/me/olympiad-ids/${editing.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          studentName: studentName.trim(),
          studentPhone: studentPhone.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveError(data.message || 'Failed to save');
      } else {
        setEditing(null);
        loadAllocations();
      }
    } catch {
      setSaveError('Network error');
    } finally {
      setSaveBusy(false);
    }
  };

  return (
    <div className="bg-white border border-gray-300 shadow-sm">
      <div className="bg-[#06013E] text-white px-6 py-3 flex items-center justify-between border-b-4 border-[#FF9000]">
        <div className="flex items-center gap-3">
          <Hash size={20} />
          <h1 className="text-base font-bold uppercase tracking-wider">Allocated Olympiad IDs</h1>
        </div>
        <div className="text-xs text-gray-300">Map each Olympiad ID to a student</div>
      </div>

      <div className="bg-gray-50 border-b border-gray-300 px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4 text-sm">
          <span>
            <span className="text-gray-600">Total: </span>
            <span className="font-bold text-[#06013E]">{stats.total}</span>
          </span>
          <span>
            <span className="text-gray-600">Assigned: </span>
            <span className="font-bold text-green-700">{stats.assigned}</span>
          </span>
          <span>
            <span className="text-gray-600">Unassigned: </span>
            <span className="font-bold text-gray-700">{stats.unassigned}</span>
          </span>
        </div>

        <button
          onClick={exportCSV}
          disabled={filtered.length === 0}
          className="inline-flex items-center gap-2 bg-[#06013E] text-white px-4 py-2 text-sm font-semibold hover:bg-[#0a0660] transition-colors disabled:opacity-50"
        >
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      <div className="px-6 py-3 border-b border-gray-300 bg-white flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Search by Olympiad ID, student name or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 text-sm focus:outline-none focus:border-[#06013E] focus:ring-1 focus:ring-[#06013E]"
          />
        </div>
        <div className="flex items-center gap-1 border border-gray-300 bg-white">
          {(['ALL', 'UNASSIGNED', 'ASSIGNED'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                statusFilter === s ? 'bg-[#06013E] text-white' : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-[#E8EAF6] border-b-2 border-[#06013E] text-[#06013E]">
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider border-r border-gray-300 w-12">#</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider border-r border-gray-300">Olympiad ID</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider border-r border-gray-300">Student Name</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider border-r border-gray-300">Phone</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider border-r border-gray-300">Status</th>
              <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider w-32">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="py-16 text-center">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#06013E] mb-2" />
                  <p className="text-gray-600 text-sm">Loading IDs...</p>
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={6} className="py-16 text-center text-red-600 text-sm">{error}</td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-16 text-center text-gray-500 text-sm">
                  {allocations.length === 0
                    ? 'No Olympiad IDs allocated yet. Please contact your Mittsure coordinator.'
                    : 'No records match your filters.'}
                </td>
              </tr>
            ) : (
              filtered.map((a, idx) => (
                <tr
                  key={a.id}
                  className={`border-b border-gray-200 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-yellow-50 transition-colors`}
                >
                  <td className="px-4 py-2.5 border-r border-gray-200 text-gray-700 text-xs">{idx + 1}</td>
                  <td className="px-4 py-2.5 border-r border-gray-200 font-mono font-semibold text-[#06013E]">{a.code}</td>
                  <td className="px-4 py-2.5 border-r border-gray-200 text-gray-800">
                    {a.studentName || <span className="text-gray-400 italic">Not assigned</span>}
                  </td>
                  <td className="px-4 py-2.5 border-r border-gray-200 text-gray-800 font-mono text-xs">
                    {a.studentPhone || <span className="text-gray-400 italic">-</span>}
                  </td>
                  <td className="px-4 py-2.5 border-r border-gray-200">
                    <span
                      className={`inline-block px-2 py-0.5 text-[10px] font-bold uppercase ${
                        a.status === 'ASSIGNED'
                          ? 'bg-green-100 text-green-800 border border-green-300'
                          : 'bg-gray-100 text-gray-700 border border-gray-300'
                      }`}
                    >
                      {a.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <button
                      onClick={() => openAssignModal(a)}
                      className="inline-flex items-center gap-1.5 bg-[#06013E] text-white px-2.5 py-1 text-xs font-semibold hover:bg-[#0a0660] transition-colors"
                    >
                      {a.status === 'ASSIGNED' ? (
                        <>
                          <Edit className="w-3 h-3" /> Edit
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-3 h-3" /> Assign
                        </>
                      )}
                    </button>
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
          <span className="font-bold">{allocations.length}</span> IDs
        </span>
        <span className="italic">© Mittsure Olympiad Portal</span>
      </div>

      {/* Assign Student Modal */}
      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="p-0 border border-gray-300 rounded-none sm:!max-w-lg w-[min(90vw,32rem)]">
          <div className="bg-[#06013E] text-white px-6 py-3 border-b-4 border-[#FF9000]">
            <DialogHeader>
              <DialogTitle className="text-base font-bold uppercase tracking-wider">
                {editing?.status === 'ASSIGNED' ? 'Edit Student' : 'Assign Student'}
              </DialogTitle>
            </DialogHeader>
          </div>

          {editing && (
            <form onSubmit={handleSaveAssignment} className="p-6 bg-white space-y-4">
              <div className="bg-gray-50 border border-gray-200 p-3 text-sm">
                <span className="text-xs text-gray-500 uppercase font-bold tracking-wider">Olympiad ID:</span>{' '}
                <span className="font-mono font-bold text-[#06013E]">{editing.code}</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#06013E] mb-1.5 uppercase tracking-wide">
                  Student Name <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  required
                  className="w-full h-10 border border-gray-300 px-3 text-sm focus:outline-none focus:border-[#06013E] focus:ring-1 focus:ring-[#06013E]"
                  placeholder="Full name"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#06013E] mb-1.5 uppercase tracking-wide">
                  Phone Number <span className="text-red-600">*</span>
                </label>
                <input
                  type="tel"
                  value={studentPhone}
                  onChange={(e) => setStudentPhone(e.target.value)}
                  required
                  pattern="\d{10}"
                  maxLength={10}
                  className="w-full h-10 border border-gray-300 px-3 text-sm font-mono focus:outline-none focus:border-[#06013E] focus:ring-1 focus:ring-[#06013E]"
                  placeholder="10 digit mobile"
                />
              </div>

              {saveError && (
                <div className="text-xs text-red-700 bg-red-50 border border-red-200 px-3 py-2">
                  {saveError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  disabled={saveBusy}
                  className="h-10 px-4 bg-white border border-gray-400 text-gray-700 font-semibold text-sm hover:bg-gray-100 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saveBusy}
                  className="h-10 px-5 bg-[#06013E] text-white font-semibold text-sm hover:bg-[#0a0660] transition-colors disabled:opacity-50"
                >
                  {saveBusy ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
