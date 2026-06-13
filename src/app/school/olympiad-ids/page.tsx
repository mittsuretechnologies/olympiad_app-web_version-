'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Hash, Loader2, Search, Download,
  Clock, BookOpen, ChevronDown, ChevronUp, UserPlus, X, Pencil, Trash2
} from 'lucide-react';

interface Allocation {
  id: string;
  code: string;
  classCode: string | null;
  className: string | null;
  sentAt: string | null;
  createdAt: string;
  assignedName: string | null;
  assignedAt: string | null;
  student?: { name: string; isVerified: boolean } | null;
}

type StatusFilter = 'ALL' | 'ASSIGNED' | 'PENDING';

export default function SchoolOlympiadIdsPage() {
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [activeClass, setActiveClass] = useState<string>('ALL');
  const [collapsedClasses, setCollapsedClasses] = useState<Set<string>>(new Set());

  // Modal state
  const [modal, setModal] = useState<{ code: string; current: string | null } | null>(null);
  const [assignName, setAssignName] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState('');

  const token = typeof window !== 'undefined' ? localStorage.getItem('schoolToken') : '';

  const fetchAllocations = () => {
    if (!token) { setError('Not logged in'); setLoading(false); return; }
    fetch('/api/school/me/olympiad-ids', { headers: { Authorization: `Bearer ${token}` } })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to load');
        setAllocations(Array.isArray(data) ? data : []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchAllocations(); }, []);

  const openModal = (code: string, current: string | null) => {
    setModal({ code, current });
    setAssignName(current || '');
    setAssignError('');
  };
  const closeModal = () => { setModal(null); setAssignName(''); setAssignError(''); };

  const handleAssign = async () => {
    if (!assignName.trim()) { setAssignError('Student name required'); return; }
    setAssigning(true); setAssignError('');
    try {
      const res = await fetch(`/api/school/me/olympiad-ids/${modal!.code}/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ assignedName: assignName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setAllocations(prev => prev.map(a =>
        a.code === modal!.code ? { ...a, assignedName: assignName.trim(), assignedAt: new Date().toISOString() } : a
      ));
      closeModal();
    } catch (e: any) {
      setAssignError(e.message);
    } finally {
      setAssigning(false);
    }
  };

  const handleUnassign = async (code: string) => {
    if (!confirm('Remove assignment for this ID?')) return;
    try {
      const res = await fetch(`/api/school/me/olympiad-ids/${code}/assign`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setAllocations(prev => prev.map(a =>
        a.code === code ? { ...a, assignedName: null, assignedAt: null } : a
      ));
    } catch (e: any) {
      alert(e.message);
    }
  };

  const classes = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of allocations) {
      const key = a.classCode || 'UNKNOWN';
      map.set(key, a.className || a.classCode || 'Unknown');
    }
    return Array.from(map.entries()).map(([code, name]) => ({ code, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [allocations]);

  const filtered = useMemo(() => {
    return allocations.filter((a) => {
      if (activeClass !== 'ALL' && (a.classCode || 'UNKNOWN') !== activeClass) return false;
      if (statusFilter === 'ASSIGNED' && !a.assignedName) return false;
      if (statusFilter === 'PENDING' && a.assignedName) return false;
      const q = search.toLowerCase();
      if (q && !a.code.toLowerCase().includes(q) &&
        !(a.student?.name || '').toLowerCase().includes(q) &&
        !(a.assignedName || '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [allocations, search, statusFilter, activeClass]);

  const grouped = useMemo(() => {
    const map = new Map<string, { label: string; items: Allocation[] }>();
    for (const a of filtered) {
      const key = a.classCode || 'UNKNOWN';
      const label = a.className || a.classCode || 'Unknown';
      if (!map.has(key)) map.set(key, { label, items: [] });
      map.get(key)!.items.push(a);
    }
    return Array.from(map.entries()).map(([code, { label, items }]) => ({ code, label, items })).sort((a, b) => a.label.localeCompare(b.label));
  }, [filtered]);

  const stats = useMemo(() => ({
    total: allocations.length,
    assigned: allocations.filter(a => a.assignedName).length,
    pending: allocations.filter(a => !a.assignedName).length,
  }), [allocations]);

  const exportCSV = () => {
    if (filtered.length === 0) return;
    const rows = [
      ['#', 'Olympiad ID', 'Class', 'Assigned To', 'Registered Student', 'Status'],
      ...filtered.map((a, i) => [
        i + 1, a.code,
        a.className || a.classCode || '-',
        a.assignedName || '-',
        a.student?.name || '-',
        a.student ? 'Registered' : a.assignedName ? 'Assigned' : 'Pending',
      ]),
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = `olympiad-ids.csv`; link.click();
    URL.revokeObjectURL(url);
  };

  const toggleCollapse = (code: string) => {
    setCollapsedClasses(prev => { const n = new Set(prev); n.has(code) ? n.delete(code) : n.add(code); return n; });
  };

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="bg-[#06013E] text-white px-6 py-3 rounded-t-xl flex items-center justify-between border-b-4 border-[#FF9000]">
          <div className="flex items-center gap-3">
            <Hash size={18} />
            <h1 className="text-sm font-bold uppercase tracking-wider">Allocated Olympiad IDs</h1>
          </div>
          <button onClick={exportCSV} disabled={filtered.length === 0}
            className="inline-flex items-center gap-1.5 bg-[#FF9000] text-[#06013E] px-3 py-1.5 text-xs font-bold hover:bg-amber-400 transition-colors disabled:opacity-40">
            <Download size={13} /> Export CSV
          </button>
        </div>

        {/* Stats bar */}
        <div className="flex flex-wrap divide-x divide-gray-100 bg-gray-50 rounded-b-xl">
          <div className="flex items-center gap-2 px-5 py-3">
            <Hash size={14} className="text-blue-600" />
            <span className="text-xl font-black text-blue-700">{stats.total}</span>
            <span className="text-xs text-gray-400">Total</span>
          </div>
          <div className="flex items-center gap-2 px-5 py-3">
            <UserPlus size={14} className="text-purple-600" />
            <span className="text-xl font-black text-purple-700">{stats.assigned}</span>
            <span className="text-xs text-gray-400">Assigned</span>
          </div>
          <div className="flex items-center gap-2 px-5 py-3">
            <Clock size={14} className="text-orange-500" />
            <span className="text-xl font-black text-orange-600">{stats.pending}</span>
            <span className="text-xs text-gray-400">Unassigned</span>
          </div>
        </div>
      </div>

      {/* Class tabs */}
      {classes.length > 1 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 flex flex-wrap gap-2">
          {[{ code: 'ALL', name: 'All Classes' }, ...classes].map((cls) => (
            <button key={cls.code} onClick={() => setActiveClass(cls.code)}
              className={`px-3 py-1.5 text-xs font-bold border rounded-lg transition-colors ${
                activeClass === cls.code ? 'bg-[#06013E] text-white border-[#06013E]' : 'bg-white text-gray-600 border-gray-200 hover:border-[#06013E]'
              }`}>
              {cls.name}
              <span className={`ml-1.5 text-[9px] px-1 py-0.5 rounded font-mono ${activeClass === cls.code ? 'bg-white/20' : 'bg-gray-100 text-gray-400'}`}>
                {cls.code === 'ALL' ? allocations.length : allocations.filter(a => (a.classCode || 'UNKNOWN') === cls.code).length}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Search + Filter */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-3 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
          <input type="text" placeholder="Search ID, name..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#06013E] focus:ring-1 focus:ring-[#06013E]" />
        </div>
        <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
          {(['ALL', 'ASSIGNED', 'PENDING'] as StatusFilter[]).map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors border-r last:border-r-0 border-gray-200 ${
                statusFilter === s ? 'bg-[#06013E] text-white' : 'text-gray-500 hover:bg-gray-50'
              }`}>{s}</button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="bg-white rounded-xl border border-gray-100 py-20 flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-[#06013E]" />
          <p className="text-sm text-gray-400">Loading...</p>
        </div>
      ) : error ? (
        <div className="bg-white rounded-xl border border-red-200 py-16 text-center text-red-600 text-sm">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 py-20 text-center text-gray-400 text-sm">
          {allocations.length === 0 ? 'No Olympiad IDs allocated yet.' : 'No records match your filters.'}
        </div>
      ) : (
        <div className="space-y-3">
          {grouped.map(({ code, label, items }) => {
            const isCollapsed = collapsedClasses.has(code);
            const classAssigned = items.filter(a => a.assignedName).length;

            return (
              <div key={code} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <button onClick={() => toggleCollapse(code)}
                  className="w-full flex items-center justify-between px-5 py-3 bg-[#E8EAF6] hover:bg-[#dde0f5] transition-colors border-b border-gray-200">
                  <div className="flex items-center gap-3">
                    <BookOpen size={14} className="text-[#06013E]" />
                    <span className="text-sm font-bold text-[#06013E]">{label}</span>
                    <span className="text-[10px] text-gray-500 font-mono bg-white px-2 py-0.5 rounded">{items.length} IDs</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="hidden sm:flex items-center gap-2 text-xs">
                      <span className="text-gray-400 text-[11px]">{classAssigned}/{items.length} assigned</span>
                    </div>
                    {isCollapsed ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronUp size={14} className="text-gray-400" />}
                  </div>
                </button>

                {!isCollapsed && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse table-fixed">
                      <thead>
                        <tr className="border-b border-gray-100 bg-gray-50 text-gray-400">
                          <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase w-10">#</th>
                          <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase w-48">Olympiad ID</th>
                          <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase">Assigned To</th>
                          <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase w-32">Status</th>
                          <th className="px-4 py-2.5 text-center text-[10px] font-bold uppercase w-24">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((a, idx) => (
                          <tr key={a.id} className={`border-b border-gray-50 hover:bg-blue-50/30 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}>
                            <td className="px-4 py-3 text-gray-400 text-xs">{idx + 1}</td>
                            <td className="px-4 py-3 font-mono font-bold text-[#06013E]">{a.code}</td>
                            <td className="px-4 py-3">
                              {a.assignedName ? (
                                <span className="font-semibold text-purple-700">{a.assignedName}</span>
                              ) : (
                                <span className="text-gray-300 italic text-xs">Not assigned</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {a.assignedName ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 rounded">
                                  <UserPlus size={9} /> Assigned
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold bg-orange-50 text-orange-600 border border-orange-200 rounded">
                                  <Clock size={9} /> Pending
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {a.assignedName ? (
                                <div className="flex items-center justify-center gap-2">
                                  <button onClick={() => openModal(a.code, a.assignedName)}
                                    className="p-1.5 rounded-lg bg-purple-50 text-purple-600 hover:bg-purple-100 transition-colors" title="Edit">
                                    <Pencil size={12} />
                                  </button>
                                  <button onClick={() => handleUnassign(a.code)}
                                    className="p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors" title="Remove">
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              ) : (
                                <button onClick={() => openModal(a.code, null)}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#06013E] text-white text-[10px] font-bold rounded-lg hover:bg-[#1a0f6e] transition-colors">
                                  <UserPlus size={10} /> Assign
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="text-xs text-gray-400 text-right italic px-1">
          Showing {filtered.length} of {allocations.length} IDs · © Mittsure Olympiad Portal
        </div>
      )}

      {/* Assign Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
            <div className="bg-[#06013E] px-5 py-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">
                  {modal.current ? 'Edit Assignment' : 'Assign Student'}
                </p>
                <p className="text-white font-bold text-sm mt-0.5 font-mono">{modal.code}</p>
              </div>
              <button onClick={closeModal} className="text-white/50 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">
                  Student Name
                </label>
                <input
                  type="text"
                  placeholder="Enter student full name"
                  value={assignName}
                  onChange={e => setAssignName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAssign()}
                  autoFocus
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#06013E] focus:ring-1 focus:ring-[#06013E]"
                />
                {assignError && <p className="text-xs text-red-500 mt-1">{assignError}</p>}
              </div>
              <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5 text-xs text-blue-700 leading-relaxed">
                Student will use this Olympiad ID to register on the app. Their name will be pre-linked to this ID.
              </div>
              <div className="flex gap-2">
                <button onClick={closeModal}
                  className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-sm font-semibold rounded-lg hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
                <button onClick={handleAssign} disabled={assigning}
                  className="flex-1 py-2.5 bg-[#06013E] text-white text-sm font-bold rounded-lg hover:bg-[#1a0f6e] transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  {assigning ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
                  {modal.current ? 'Update' : 'Assign'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
