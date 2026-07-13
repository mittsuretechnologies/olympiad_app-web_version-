'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Hash, Loader2, Search, Download,
  Clock, BookOpen, ChevronDown, ChevronUp, UserPlus, X, Pencil, Trash2, CheckCircle, Phone, Eye, EyeOff, Mail
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
  hasAppUser?: boolean;
  appUserPhone?: string | null;
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

  // Assign modal
  const [modal, setModal] = useState<{ code: string; current: string | null } | null>(null);
  const [assignName, setAssignName] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState('');

  // Register modal
  const [regModal, setRegModal] = useState<{ code: string; assignedName: string } | null>(null);
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [regError, setRegError] = useState('');
  const [regSuccess, setRegSuccess] = useState<{ userId: string; email: string; emailSent: boolean; emailError: string | null } | null>(null);

  // Edit app account modal (for ALLOTTED rows — name + phone)
  const [editAppModal, setEditAppModal] = useState<{ code: string } | null>(null);
  const [editAppName, setEditAppName] = useState('');
  const [editAppPhone, setEditAppPhone] = useState('');
  const [editingApp, setEditingApp] = useState(false);
  const [editAppError, setEditAppError] = useState('');

  // Allot Student modal
  const [allotOpen, setAllotOpen] = useState(false);
  const [allotName, setAllotName] = useState('');
  const [allotPhone, setAllotPhone] = useState('');
  const [allotEmail, setAllotEmail] = useState('');
  const [allotClass, setAllotClass] = useState('');
  const [allotting, setAllotting] = useState(false);
  const [allotError, setAllotError] = useState('');
  const [allotSuccess, setAllotSuccess] = useState<{ code: string; userId: string; password: string; email: string; emailSent: boolean; emailError: string | null } | null>(null);

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

  // Assign handlers
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
    if (!confirm('Remove assignment for this ID? Any app account linked to it will also be removed.')) return;
    try {
      const res = await fetch(`/api/school/me/olympiad-ids/${code}/assign`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setAllocations(prev => prev.map(a =>
        a.code === code ? { ...a, assignedName: null, assignedAt: null, hasAppUser: false, appUserPhone: null } : a
      ));
    } catch (e: any) {
      alert(e.message);
    }
  };

  // Edit app account handlers (ALLOTTED rows)
  const openEditAppModal = (a: Allocation) => {
    setEditAppModal({ code: a.code });
    setEditAppName(a.assignedName || '');
    setEditAppPhone(a.appUserPhone || '');
    setEditAppError('');
  };
  const closeEditAppModal = () => {
    setEditAppModal(null); setEditAppName(''); setEditAppPhone(''); setEditAppError('');
  };

  const handleEditApp = async () => {
    if (!editAppName.trim()) { setEditAppError('Student name is required'); return; }
    if (!editAppPhone.trim() || editAppPhone.trim().length < 10) { setEditAppError('Valid phone number is required'); return; }
    setEditingApp(true); setEditAppError('');
    try {
      const res = await fetch(`/api/school/me/olympiad-ids/${editAppModal!.code}/app-account`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: editAppName.trim(), phone: editAppPhone.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setAllocations(prev => prev.map(a =>
        a.code === editAppModal!.code ? { ...a, assignedName: editAppName.trim(), appUserPhone: editAppPhone.trim() } : a
      ));
      closeEditAppModal();
    } catch (e: any) {
      setEditAppError(e.message);
    } finally {
      setEditingApp(false);
    }
  };

  // Register handlers
  const openRegModal = (code: string, assignedName: string) => {
    setRegModal({ code, assignedName });
    setRegName(assignedName);
    setRegPhone('');
    setRegEmail('');
    setRegPassword('');
    setRegError('');
    setRegSuccess(null);
  };
  const closeRegModal = () => {
    setRegModal(null); setRegName(''); setRegPhone(''); setRegEmail('');
    setRegPassword(''); setRegError(''); setRegSuccess(null);
  };

  const handleRegister = async () => {
    if (!regName.trim()) { setRegError('Student name is required'); return; }
    if (!regPhone.trim() || regPhone.trim().length < 10) { setRegError('Valid phone number is required'); return; }
    if (regEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regEmail.trim())) { setRegError('Enter a valid email address'); return; }
    if (!regPassword.trim() || regPassword.trim().length < 6) { setRegError('Password must be at least 6 characters'); return; }
    setRegistering(true); setRegError('');
    try {
      const res = await fetch(`/api/school/me/olympiad-ids/${regModal!.code}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: regName.trim(), phone: regPhone.trim(), email: regEmail.trim() || null, password: regPassword.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      // Mark as registered (hasAppUser = true) in local state
      setAllocations(prev => prev.map(a =>
        a.code === regModal!.code
          ? { ...a, assignedName: regName.trim(), hasAppUser: true }
          : a
      ));
      setRegSuccess({ userId: data.userId, email: regEmail.trim(), emailSent: !!data.emailSent, emailError: data.emailError || null });
    } catch (e: any) {
      setRegError(e.message);
    } finally {
      setRegistering(false);
    }
  };

  // Allot handlers
  const openAllotModal = () => {
    setAllotOpen(true);
    setAllotName(''); setAllotPhone(''); setAllotEmail(''); setAllotClass(activeClass !== 'ALL' ? activeClass : '');
    setAllotError(''); setAllotSuccess(null);
  };
  const closeAllotModal = () => {
    setAllotOpen(false); setAllotName(''); setAllotPhone(''); setAllotEmail(''); setAllotClass('');
    setAllotError(''); setAllotSuccess(null);
  };

  const handleAllot = async () => {
    if (!allotName.trim()) { setAllotError('Student name is required'); return; }
    if (!allotPhone.trim() || allotPhone.trim().length < 10) { setAllotError('Valid phone number is required'); return; }
    if (allotEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(allotEmail.trim())) { setAllotError('Enter a valid email address'); return; }
    if (!allotClass.trim()) { setAllotError('Please select a class'); return; }
    setAllotting(true); setAllotError('');
    try {
      const res = await fetch('/api/school/me/olympiad-ids/allot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: allotName.trim(), phone: allotPhone.trim(), email: allotEmail.trim() || null, classCode: allotClass.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setAllotSuccess({ code: data.code, userId: data.userId, password: data.password, email: allotEmail.trim(), emailSent: !!data.emailSent, emailError: data.emailError || null });
      fetchAllocations();
    } catch (e: any) {
      setAllotError(e.message);
    } finally {
      setAllotting(false);
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
    <div className="space-y-3">

      {/* Title bar */}
      <div className="bg-white border border-gray-300">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-300 bg-[#F4F5F7]">
          <div className="flex items-center gap-2">
            <Hash size={15} className="text-[#06013E]" />
            <h1 className="text-[13px] font-bold text-[#06013E] uppercase tracking-wide">Olympiad ID Allotment</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={exportCSV} disabled={filtered.length === 0}
              className="inline-flex items-center gap-1.5 bg-white text-[#1F2937] px-4 py-2 text-xs font-semibold rounded-full hover:bg-gray-50 transition-colors border border-[#E7EBF2] disabled:opacity-40">
              <Download size={14} /> Export CSV
            </button>
            <button onClick={openAllotModal}
              className="inline-flex items-center gap-1.5 bg-[#2357D8] text-white px-4 py-2 text-xs font-semibold rounded-full hover:bg-[#1D4ED8] transition-colors">
              <UserPlus size={14} /> Allot Student
            </button>
          </div>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-3 divide-x divide-y sm:divide-y-0 divide-gray-200">
          <div className="px-4 py-2.5 flex items-center justify-between">
            <span className="text-[11px] text-gray-600 font-medium">Total Allotted</span>
            <span className="text-sm font-bold text-[#06013E] font-mono">{stats.total}</span>
          </div>
          <div className="px-4 py-2.5 flex items-center justify-between">
            <span className="text-[11px] text-gray-600 font-medium">Assigned</span>
            <span className="text-sm font-bold text-[#06013E] font-mono">{stats.assigned}</span>
          </div>
          <div className="px-4 py-2.5 flex items-center justify-between">
            <span className="text-[11px] text-gray-600 font-medium">Unassigned</span>
            <span className="text-sm font-bold text-red-700 font-mono">{stats.pending}</span>
          </div>
        </div>
      </div>

      {/* Class tabs + Search + Filter — single utility bar */}
      <div className="bg-white border border-gray-300 px-4 py-2.5 flex flex-wrap items-center gap-3">
        {classes.length > 1 && (
          <div className="flex items-center border border-gray-300 divide-x divide-gray-300">
            {[{ code: 'ALL', name: 'All Classes' }, ...classes].map((cls) => (
              <button key={cls.code} onClick={() => setActiveClass(cls.code)}
                className={`px-3 py-1.5 text-[11px] font-semibold transition-colors whitespace-nowrap ${
                  activeClass === cls.code ? 'bg-[#06013E] text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}>
                {cls.name} ({cls.code === 'ALL' ? allocations.length : allocations.filter(a => (a.classCode || 'UNKNOWN') === cls.code).length})
              </button>
            ))}
          </div>
        )}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
          <input type="text" placeholder="Search ID or name" value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-7 pr-3 py-1.5 border border-gray-300 text-[12px] focus:outline-none focus:border-[#06013E]" />
        </div>
        <div className="flex items-center border border-gray-300 divide-x divide-gray-300 ml-auto">
          {(['ALL', 'ASSIGNED', 'PENDING'] as StatusFilter[]).map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide transition-colors ${
                statusFilter === s ? 'bg-[#06013E] text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}>{s}</button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="bg-white border border-gray-300 py-20 flex flex-col items-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-[#06013E]" />
          <p className="text-sm text-gray-500">Loading records...</p>
        </div>
      ) : error ? (
        <div className="bg-white border border-red-300 py-16 text-center text-red-700 text-sm">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-gray-300 py-20 text-center text-gray-500 text-sm">
          {allocations.length === 0 ? 'No Olympiad IDs allocated yet.' : 'No records match your filters.'}
        </div>
      ) : (
        <div className="space-y-3">
          {grouped.map(({ code, label, items }) => {
            const isCollapsed = collapsedClasses.has(code);
            const classAssigned = items.filter(a => a.assignedName).length;

            return (
              <div key={code} className="bg-white border border-gray-300">
                <button onClick={() => toggleCollapse(code)}
                  className="w-full flex items-center justify-between px-4 py-2.5 bg-[#F4F5F7] hover:bg-gray-100 transition-colors border-b border-gray-300">
                  <div className="flex items-center gap-2.5">
                    <BookOpen size={13} className="text-[#06013E]" />
                    <span className="text-[12.5px] font-bold text-[#06013E] uppercase tracking-wide">{label}</span>
                    <span className="text-[10px] text-gray-500 font-mono border border-gray-300 bg-white px-1.5 py-0.5">{items.length} IDs</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="hidden sm:flex items-center gap-3 text-[11px] text-gray-600">
                      <span>{classAssigned}/{items.length} assigned</span>
                    </div>
                    {isCollapsed ? <ChevronDown size={14} className="text-gray-500" /> : <ChevronUp size={14} className="text-gray-500" />}
                  </div>
                </button>

                {!isCollapsed && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse table-fixed">
                      <thead>
                        <tr className="border-b border-gray-300 bg-gray-50 text-gray-600">
                          <th className="px-3 py-2 text-left text-[10.5px] font-bold uppercase border-r border-gray-200 w-12">Sr.No.</th>
                          <th className="px-3 py-2 text-left text-[10.5px] font-bold uppercase border-r border-gray-200 w-40">Olympiad ID</th>
                          <th className="px-3 py-2 text-left text-[10.5px] font-bold uppercase border-r border-gray-200">Student Name</th>
                          <th className="px-3 py-2 text-left text-[10.5px] font-bold uppercase border-r border-gray-200 w-32">Status</th>
                          <th className="px-3 py-2 text-center text-[10.5px] font-bold uppercase w-32">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((a, idx) => (
                          <tr key={a.id} className={`border-b border-gray-200 hover:bg-gray-50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'}`}>
                            <td className="px-3 py-2 text-gray-500 text-xs border-r border-gray-100">{idx + 1}</td>
                            <td className="px-3 py-2 font-mono font-semibold text-[#06013E] border-r border-gray-100">{a.code}</td>
                            <td className="px-3 py-2 border-r border-gray-100">
                              {a.assignedName ? (
                                <span className="font-medium text-gray-800">{a.assignedName}</span>
                              ) : (
                                <span className="text-gray-400 text-xs">— Not Assigned —</span>
                              )}
                            </td>
                            <td className="px-3 py-2 border-r border-gray-100">
                              {a.student ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold text-green-700 border border-green-300 bg-green-50">
                                  REGISTERED
                                </span>
                              ) : a.hasAppUser ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 border border-blue-300 bg-blue-50">
                                  ALLOTTED
                                </span>
                              ) : a.assignedName ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-300 bg-amber-50">
                                  ASSIGNED
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold text-red-700 border border-red-300 bg-red-50">
                                  PENDING
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {a.student ? (
                                <span className="text-[11px] text-gray-400">—</span>
                              ) : a.hasAppUser ? (
                                <div className="flex items-center justify-center gap-1">
                                  <button onClick={() => openEditAppModal(a)}
                                    className="p-1 border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors" title="Edit name & phone">
                                    <Pencil size={11} />
                                  </button>
                                  <button onClick={() => handleUnassign(a.code)}
                                    className="p-1 border border-gray-300 text-red-600 hover:bg-red-50 transition-colors" title="Remove">
                                    <Trash2 size={11} />
                                  </button>
                                </div>
                              ) : a.assignedName ? (
                                <div className="flex items-center justify-center gap-1">
                                  <button onClick={() => openRegModal(a.code, a.assignedName!)}
                                    className="inline-flex items-center gap-1 px-2 py-1 bg-green-700 text-white text-[10px] font-semibold hover:bg-green-800 transition-colors">
                                    Register
                                  </button>
                                  <button onClick={() => openModal(a.code, a.assignedName)}
                                    className="p-1 border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors" title="Edit name">
                                    <Pencil size={11} />
                                  </button>
                                  <button onClick={() => handleUnassign(a.code)}
                                    className="p-1 border border-gray-300 text-red-600 hover:bg-red-50 transition-colors" title="Remove">
                                    <Trash2 size={11} />
                                  </button>
                                </div>
                              ) : (
                                <span className="text-[11px] text-gray-400">—</span>
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
        <div className="text-[11px] text-gray-500 text-right px-1">
          Showing {filtered.length} of {allocations.length} records · mittmee
        </div>
      )}

      {/* Assign Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white border border-gray-400 shadow-lg w-full max-w-sm mx-4 overflow-hidden">
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
                  className="w-full border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-[#06013E] focus:ring-1 focus:ring-[#06013E]"
                />
                {assignError && <p className="text-xs text-red-500 mt-1">{assignError}</p>}
              </div>
              <div className="bg-gray-50 border border-gray-300 px-3 py-2 text-xs text-gray-700 leading-relaxed">
                After assigning, use the Register button to create their account directly.
              </div>
              <div className="flex gap-2">
                <button onClick={closeModal}
                  className="flex-1 py-2.5 rounded-full border border-[#E7EBF2] text-[#1F2937] text-sm font-semibold hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
                <button onClick={handleAssign} disabled={assigning}
                  className="flex-1 py-2.5 rounded-full bg-[#2357D8] text-white text-sm font-semibold hover:bg-[#1D4ED8] transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  {assigning ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
                  {modal.current ? 'Update' : 'Assign'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit App Account Modal (ALLOTTED rows) */}
      {editAppModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white border border-gray-400 shadow-lg w-full max-w-sm mx-4 overflow-hidden">
            <div className="bg-[#06013E] px-5 py-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">Edit Student Details</p>
                <p className="text-white font-bold text-sm mt-0.5 font-mono">{editAppModal.code}</p>
              </div>
              <button onClick={closeEditAppModal} className="text-white/50 hover:text-white transition-colors">
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
                  value={editAppName}
                  onChange={e => setEditAppName(e.target.value)}
                  autoFocus
                  className="w-full border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-[#06013E] focus:ring-1 focus:ring-[#06013E]"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="tel"
                    placeholder="10-digit mobile"
                    value={editAppPhone}
                    onChange={e => setEditAppPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    onKeyDown={e => e.key === 'Enter' && handleEditApp()}
                    className="w-full pl-8 pr-3 border border-gray-300 py-2 text-sm focus:outline-none focus:border-[#06013E] focus:ring-1 focus:ring-[#06013E]"
                  />
                </div>
              </div>
              {editAppError && <p className="text-xs text-red-500">{editAppError}</p>}
              <div className="bg-gray-50 border border-gray-300 px-3 py-2 text-xs text-gray-700 leading-relaxed">
                This updates the student&apos;s app account. The login password stays unchanged.
              </div>
              <div className="flex gap-2">
                <button onClick={closeEditAppModal}
                  className="flex-1 py-2.5 rounded-full border border-[#E7EBF2] text-[#1F2937] text-sm font-semibold hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
                <button onClick={handleEditApp} disabled={editingApp}
                  className="flex-1 py-2.5 rounded-full bg-[#2357D8] text-white text-sm font-semibold hover:bg-[#1D4ED8] transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  {editingApp ? <Loader2 size={14} className="animate-spin" /> : <Pencil size={14} />}
                  Update
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Register Modal */}
      {regModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white border border-gray-400 shadow-lg w-full max-w-sm mx-4 overflow-hidden">
            <div className="bg-[#06013E] px-5 py-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">Register Student</p>
                <p className="text-white font-bold text-sm mt-0.5 font-mono">{regModal.code}</p>
              </div>
              <button onClick={closeRegModal} className="text-white/50 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            {regSuccess ? (
              /* ── Success screen ── */
              <div className="p-6 text-center space-y-4">
                <div className="w-14 h-14 border border-green-300 bg-green-50 flex items-center justify-center mx-auto">
                  <CheckCircle className="w-7 h-7 text-green-700" />
                </div>
                <div>
                  <p className="font-bold text-gray-900 text-base">Account Created!</p>
                  <p className="text-xs text-gray-400 mt-1">Share these login details with the student</p>
                </div>
                <div className="bg-gray-50 border border-gray-300 p-4 text-left space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400 font-semibold uppercase tracking-wide">User ID</span>
                    <span className="font-mono font-bold text-black">{regSuccess.userId}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400 font-semibold uppercase tracking-wide">Olympiad ID</span>
                    <span className="font-mono font-bold text-black">{regModal.code}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400 font-semibold uppercase tracking-wide">Phone</span>
                    <span className="font-mono text-gray-700">{regPhone}</span>
                  </div>
                </div>
                {regSuccess.emailSent ? (
                  <p className="text-xs text-green-800 bg-green-50 border border-green-300 px-3 py-2">
                    Credentials emailed to {regSuccess.email}. Student can log in to the app using their phone number and password.
                  </p>
                ) : regSuccess.email ? (
                  <p className="text-xs text-red-800 bg-red-50 border border-red-300 px-3 py-2">
                    Could not email credentials ({regSuccess.emailError || 'mail error'}) — share the login details with the student manually.
                  </p>
                ) : (
                  <p className="text-xs text-gray-700 bg-gray-50 border border-gray-300 px-3 py-2">
                    Student can now log in to the app using their phone number and password.
                  </p>
                )}
                <button onClick={closeRegModal}
                  className="w-full py-2.5 rounded-full bg-green-700 text-white text-sm font-semibold hover:bg-green-800 transition-colors">
                  Done
                </button>
              </div>
            ) : (
              /* ── Form ── */
              <div className="p-5 space-y-3.5">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Student Name</label>
                  <input
                    type="text" placeholder="Full name" value={regName}
                    onChange={e => setRegName(e.target.value)} autoFocus
                    className="w-full border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Phone Number</label>
                  <div className="relative">
                    <Phone size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="tel" placeholder="10-digit mobile" value={regPhone}
                      onChange={e => setRegPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      className="w-full pl-8 pr-3 border border-gray-300 py-2 text-sm focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Email Address</label>
                  <div className="relative">
                    <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="email" placeholder="student@example.com (credentials will be emailed)" value={regEmail}
                      onChange={e => setRegEmail(e.target.value)}
                      className="w-full pl-8 pr-3 border border-gray-300 py-2 text-sm focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Password</label>
                  <div className="relative">
                    <input
                      type={showRegPassword ? 'text' : 'password'}
                      placeholder="Min 6 characters"
                      value={regPassword}
                      onChange={e => setRegPassword(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleRegister()}
                      className="w-full pr-10 pl-3 border border-gray-300 py-2 text-sm focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
                    />
                    <button type="button" onClick={() => setShowRegPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showRegPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
                {regError && <p className="text-xs text-red-500">{regError}</p>}
                <div className="bg-gray-50 border border-gray-300 px-3 py-2 text-xs text-gray-700">
                  Account will be created on the app. Student can log in with their phone + password.
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={closeRegModal}
                    className="flex-1 py-2.5 rounded-full border border-[#E7EBF2] text-[#1F2937] text-sm font-semibold hover:bg-gray-50 transition-colors">
                    Cancel
                  </button>
                  <button onClick={handleRegister} disabled={registering}
                    className="flex-1 py-2.5 rounded-full bg-green-700 text-white text-sm font-semibold hover:bg-green-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                    {registering ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                    Register
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Allot Student Modal */}
      {allotOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white border border-gray-400 shadow-lg w-full max-w-sm mx-4 overflow-hidden">
            <div className="bg-[#06013E] px-5 py-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">Allot Student</p>
                <p className="text-white font-bold text-sm mt-0.5">An Olympiad ID will be auto-assigned</p>
              </div>
              <button onClick={closeAllotModal} className="text-white/50 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            {allotSuccess ? (
              <div className="p-6 text-center space-y-4">
                <div className="w-14 h-14 border border-green-300 bg-green-50 flex items-center justify-center mx-auto">
                  <CheckCircle className="w-7 h-7 text-green-700" />
                </div>
                <div>
                  <p className="font-bold text-gray-900 text-base">Student Allotted!</p>
                  <p className="text-xs text-gray-400 mt-1">Share these login details with the student</p>
                </div>
                <div className="bg-gray-50 border border-gray-300 p-4 text-left space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400 font-semibold uppercase tracking-wide">Olympiad ID</span>
                    <span className="font-mono font-bold text-black">{allotSuccess.code}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400 font-semibold uppercase tracking-wide">User ID</span>
                    <span className="font-mono font-bold text-black">{allotSuccess.userId}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400 font-semibold uppercase tracking-wide">Password</span>
                    <span className="font-mono font-bold text-black">{allotSuccess.password}</span>
                  </div>
                </div>
                {allotSuccess.emailSent ? (
                  <p className="text-xs text-green-800 bg-green-50 border border-green-300 px-3 py-2">
                    Credentials emailed to {allotSuccess.email}. Student can log in to the app using their phone number and this password.
                  </p>
                ) : allotSuccess.email ? (
                  <p className="text-xs text-red-800 bg-red-50 border border-red-300 px-3 py-2">
                    Could not email credentials ({allotSuccess.emailError || 'mail error'}) — share these details with the student manually.
                  </p>
                ) : (
                  <p className="text-xs text-gray-700 bg-gray-50 border border-gray-300 px-3 py-2">
                    Student can now log in to the app using their phone number and this password.
                  </p>
                )}
                <div className="flex gap-2">
                  <button onClick={openAllotModal}
                    className="flex-1 py-2.5 rounded-full border border-[#E7EBF2] text-[#1F2937] text-sm font-semibold hover:bg-gray-50 transition-colors">
                    Allot Another
                  </button>
                  <button onClick={closeAllotModal}
                    className="flex-1 py-2.5 rounded-full bg-green-700 text-white text-sm font-semibold hover:bg-green-800 transition-colors">
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-5 space-y-3.5">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Student Name</label>
                  <input
                    type="text" placeholder="Full name" value={allotName}
                    onChange={e => setAllotName(e.target.value)} autoFocus
                    className="w-full border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Class</label>
                  <select
                    value={allotClass} onChange={e => setAllotClass(e.target.value)}
                    className="w-full border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 bg-white"
                  >
                    <option value="">Select class</option>
                    {classes.map(cls => (
                      <option key={cls.code} value={cls.code}>{cls.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Phone Number</label>
                  <div className="relative">
                    <Phone size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="tel" placeholder="10-digit mobile" value={allotPhone}
                      onChange={e => setAllotPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      onKeyDown={e => e.key === 'Enter' && handleAllot()}
                      className="w-full pl-8 pr-3 border border-gray-300 py-2 text-sm focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Email Address</label>
                  <div className="relative">
                    <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="email" placeholder="student@example.com (credentials will be emailed)" value={allotEmail}
                      onChange={e => setAllotEmail(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAllot()}
                      className="w-full pl-8 pr-3 border border-gray-300 py-2 text-sm focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
                    />
                  </div>
                </div>
                {allotError && <p className="text-xs text-red-500">{allotError}</p>}
                <div className="bg-gray-50 border border-gray-300 px-3 py-2 text-xs text-gray-700">
                  The next available Olympiad ID for this class will be assigned automatically, and a password will be generated for the student. If an email is entered, the credentials will be sent there automatically.
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={closeAllotModal}
                    className="flex-1 py-2.5 rounded-full border border-[#E7EBF2] text-[#1F2937] text-sm font-semibold hover:bg-gray-50 transition-colors">
                    Cancel
                  </button>
                  <button onClick={handleAllot} disabled={allotting}
                    className="flex-1 py-2.5 rounded-full bg-green-700 text-white text-sm font-semibold hover:bg-green-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                    {allotting ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
                    Allot
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
