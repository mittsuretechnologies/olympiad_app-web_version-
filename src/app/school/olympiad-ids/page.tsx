'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Hash, Loader2, Search, Download, Plus,
  ChevronDown, BadgeCheck, UserCircle2, Pencil, Trash2,
  CheckCircle2, Phone, Eye, EyeOff, Copy, Check, Sparkles,
  Users, UserCheck, UserX, X, GraduationCap
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

function CopyButton({ value, className = '' }: { value: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className={`inline-flex items-center justify-center rounded-md p-1 text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition-colors ${className}`}
      title="Copy"
    >
      {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
    </button>
  );
}

export default function SchoolOlympiadIdsPage() {
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [activeClass, setActiveClass] = useState<string>('ALL');

  // Assign modal
  const [modal, setModal] = useState<{ code: string; current: string | null } | null>(null);
  const [assignName, setAssignName] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState('');

  // Register modal
  const [regModal, setRegModal] = useState<{ code: string; assignedName: string } | null>(null);
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [regError, setRegError] = useState('');
  const [regSuccess, setRegSuccess] = useState<{ userId: string } | null>(null);

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
  const [allotClass, setAllotClass] = useState('');
  const [allotting, setAllotting] = useState(false);
  const [allotError, setAllotError] = useState('');
  const [allotSuccess, setAllotSuccess] = useState<{ code: string; userId: string; password: string } | null>(null);

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
    setRegPassword('');
    setRegError('');
    setRegSuccess(null);
  };
  const closeRegModal = () => {
    setRegModal(null); setRegName(''); setRegPhone('');
    setRegPassword(''); setRegError(''); setRegSuccess(null);
  };

  const handleRegister = async () => {
    if (!regName.trim()) { setRegError('Student name is required'); return; }
    if (!regPhone.trim() || regPhone.trim().length < 10) { setRegError('Valid phone number is required'); return; }
    if (!regPassword.trim() || regPassword.trim().length < 6) { setRegError('Password must be at least 6 characters'); return; }
    setRegistering(true); setRegError('');
    try {
      const res = await fetch(`/api/school/me/olympiad-ids/${regModal!.code}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: regName.trim(), phone: regPhone.trim(), password: regPassword.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setAllocations(prev => prev.map(a =>
        a.code === regModal!.code
          ? { ...a, assignedName: regName.trim(), hasAppUser: true }
          : a
      ));
      setRegSuccess({ userId: data.userId });
    } catch (e: any) {
      setRegError(e.message);
    } finally {
      setRegistering(false);
    }
  };

  // Allot handlers
  const openAllotModal = () => {
    setAllotOpen(true);
    setAllotName(''); setAllotPhone(''); setAllotClass(activeClass !== 'ALL' ? activeClass : '');
    setAllotError(''); setAllotSuccess(null);
  };
  const closeAllotModal = () => {
    setAllotOpen(false); setAllotName(''); setAllotPhone(''); setAllotClass('');
    setAllotError(''); setAllotSuccess(null);
  };

  const handleAllot = async () => {
    if (!allotName.trim()) { setAllotError('Student name is required'); return; }
    if (!allotPhone.trim() || allotPhone.trim().length < 10) { setAllotError('Valid phone number is required'); return; }
    if (!allotClass.trim()) { setAllotError('Please select a class'); return; }
    setAllotting(true); setAllotError('');
    try {
      const res = await fetch('/api/school/me/olympiad-ids/allot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: allotName.trim(), phone: allotPhone.trim(), classCode: allotClass.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setAllotSuccess({ code: data.code, userId: data.userId, password: data.password });
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-violet-50/40 -m-4 sm:-m-6 p-4 sm:p-6 space-y-5">

      {/* Hero header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-600 px-6 py-7 sm:px-8 sm:py-8 text-white shadow-lg shadow-indigo-200/50">
        <div className="absolute -top-10 -right-10 w-56 h-56 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-16 left-1/3 w-64 h-64 rounded-full bg-white/10 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-5">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm ring-1 ring-white/20">
              <Hash size={22} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Olympiad ID Allotment</h1>
              <p className="text-sm text-white/70 mt-0.5">Manage student IDs, assignments &amp; app access</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={exportCSV} disabled={filtered.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 backdrop-blur-sm px-3.5 py-2.5 text-sm font-semibold text-white ring-1 ring-white/25 hover:bg-white/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              <Download size={15} /> Export
            </button>
            <button onClick={openAllotModal}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white px-4 py-2.5 text-sm font-bold text-indigo-700 shadow-md hover:bg-indigo-50 transition-colors">
              <Plus size={16} /> Allot Student
            </button>
          </div>
        </div>

        {/* Stats inline */}
        <div className="relative mt-7 grid grid-cols-3 gap-3 sm:gap-4">
          <div className="rounded-xl bg-white/10 backdrop-blur-sm ring-1 ring-white/15 px-4 py-3.5">
            <div className="flex items-center gap-2 text-white/70 text-xs font-medium">
              <Users size={13} /> Total Allotted
            </div>
            <p className="mt-1.5 text-2xl font-bold tabular-nums">{stats.total}</p>
          </div>
          <div className="rounded-xl bg-white/10 backdrop-blur-sm ring-1 ring-white/15 px-4 py-3.5">
            <div className="flex items-center gap-2 text-white/70 text-xs font-medium">
              <UserCheck size={13} /> Assigned
            </div>
            <p className="mt-1.5 text-2xl font-bold tabular-nums text-emerald-300">{stats.assigned}</p>
          </div>
          <div className="rounded-xl bg-white/10 backdrop-blur-sm ring-1 ring-white/15 px-4 py-3.5">
            <div className="flex items-center gap-2 text-white/70 text-xs font-medium">
              <UserX size={13} /> Unassigned
            </div>
            <p className="mt-1.5 text-2xl font-bold tabular-nums text-amber-300">{stats.pending}</p>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="rounded-2xl bg-white border border-slate-200/80 shadow-sm px-4 py-3.5 flex flex-wrap items-center gap-3">
        {classes.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {[{ code: 'ALL', name: 'All Classes' }, ...classes].map((cls) => {
              const count = cls.code === 'ALL' ? allocations.length : allocations.filter(a => (a.classCode || 'UNKNOWN') === cls.code).length;
              const active = activeClass === cls.code;
              return (
                <button key={cls.code} onClick={() => setActiveClass(cls.code)}
                  className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
                    active
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}>
                  {cls.name}
                  <span className={`rounded-full px-1.5 py-px text-[10px] font-bold ${active ? 'bg-white/25' : 'bg-white text-slate-500'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        )}
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          <input type="text" placeholder="Search ID or name..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full rounded-full bg-slate-100 border border-transparent pl-9 pr-3 py-2 text-sm focus:outline-none focus:bg-white focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all" />
        </div>
        <div className="flex items-center gap-1 rounded-full bg-slate-100 p-1 ml-auto">
          {(['ALL', 'ASSIGNED', 'PENDING'] as StatusFilter[]).map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
                statusFilter === s ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}>
              {s === 'ALL' ? 'All' : s === 'ASSIGNED' ? 'Assigned' : 'Pending'}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="rounded-2xl bg-white border border-slate-200/80 shadow-sm py-24 flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
          <p className="text-sm text-slate-400">Loading records...</p>
        </div>
      ) : error ? (
        <div className="rounded-2xl bg-white border border-red-200 py-16 text-center text-red-600 text-sm shadow-sm">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl bg-white border border-slate-200/80 shadow-sm py-24 flex flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-50">
            <Sparkles size={22} className="text-indigo-400" />
          </div>
          <p className="text-sm text-slate-500 max-w-xs">
            {allocations.length === 0 ? 'No Olympiad IDs allocated yet. Click "Allot Student" to get started.' : 'No records match your filters.'}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl bg-white border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50/80 text-slate-500 border-b border-slate-200">
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide w-12">#</th>
                  <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide">Olympiad ID</th>
                  <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide">Class</th>
                  <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide">Student</th>
                  <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide">Status</th>
                  <th className="px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-wide pr-5">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a, idx) => (
                  <tr key={a.id} className="group border-b border-slate-100 last:border-b-0 hover:bg-indigo-50/40 transition-colors">
                    <td className="px-5 py-3.5 text-slate-400 text-xs">{idx + 1}</td>
                    <td className="px-3 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-semibold text-slate-700 text-[13px]">{a.code}</span>
                        <CopyButton value={a.code} className="opacity-0 group-hover:opacity-100" />
                      </div>
                    </td>
                    <td className="px-3 py-3.5">
                      <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                        <GraduationCap size={11} /> {a.className || a.classCode || '-'}
                      </span>
                    </td>
                    <td className="px-3 py-3.5">
                      {a.assignedName ? (
                        <span className="font-medium text-slate-800">{a.assignedName}</span>
                      ) : (
                        <span className="text-slate-300 text-xs italic">Not assigned</span>
                      )}
                    </td>
                    <td className="px-3 py-3.5">
                      {a.student ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 ring-1 ring-emerald-200">
                          <BadgeCheck size={12} /> Registered
                        </span>
                      ) : a.hasAppUser ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700 ring-1 ring-blue-200">
                          <BadgeCheck size={12} /> Allotted
                        </span>
                      ) : a.assignedName ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700 ring-1 ring-amber-200">
                          <UserCircle2 size={12} /> Assigned
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-500 ring-1 ring-slate-200">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3.5 pr-5 text-right">
                      {a.student ? (
                        <span className="text-[11px] text-slate-300">—</span>
                      ) : a.hasAppUser ? (
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEditAppModal(a)}
                            className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors" title="Edit name & phone">
                            <Pencil size={13} />
                          </button>
                          <button onClick={() => handleUnassign(a.code)}
                            className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Remove">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ) : a.assignedName ? (
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openRegModal(a.code, a.assignedName!)}
                            className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 text-white px-2.5 py-1.5 text-[11px] font-semibold hover:bg-indigo-700 transition-colors shadow-sm">
                            Create Login
                          </button>
                          <button onClick={() => openModal(a.code, a.assignedName)}
                            className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors" title="Edit name">
                            <Pencil size={13} />
                          </button>
                          <button onClick={() => handleUnassign(a.code)}
                            className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Remove">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => openModal(a.code, null)}
                          className="inline-flex items-center gap-1 rounded-lg bg-slate-100 text-slate-600 px-2.5 py-1.5 text-[11px] font-semibold hover:bg-slate-200 transition-colors">
                          <Plus size={12} /> Assign
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/60 text-[11px] text-slate-400 text-right">
            Showing {filtered.length} of {allocations.length} records · Mittsure Technologies — Olympiad Portal
          </div>
        </div>
      )}

      {/* Assign Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/60">
                  {modal.current ? 'Edit Assignment' : 'Assign Student'}
                </p>
                <p className="text-white font-bold text-sm mt-0.5 font-mono">{modal.code}</p>
              </div>
              <button onClick={closeModal} className="text-white/60 hover:text-white transition-colors rounded-full p-1 hover:bg-white/10">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">
                  Student Name
                </label>
                <input
                  type="text"
                  placeholder="Enter student full name"
                  value={assignName}
                  onChange={e => setAssignName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAssign()}
                  autoFocus
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                />
                {assignError && <p className="text-xs text-red-500 mt-1.5">{assignError}</p>}
              </div>
              <div className="rounded-xl bg-indigo-50 px-3.5 py-2.5 text-xs text-indigo-700 leading-relaxed">
                After assigning, use <span className="font-semibold">Create Login</span> to set up their app account.
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={closeModal}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors">
                  Cancel
                </button>
                <button onClick={handleAssign} disabled={assigning}
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm">
                  {assigning ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  {modal.current ? 'Update' : 'Assign'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit App Account Modal (ALLOTTED rows) */}
      {editAppModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/60">Edit Student Details</p>
                <p className="text-white font-bold text-sm mt-0.5 font-mono">{editAppModal.code}</p>
              </div>
              <button onClick={closeEditAppModal} className="text-white/60 hover:text-white transition-colors rounded-full p-1 hover:bg-white/10">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">
                  Student Name
                </label>
                <input
                  type="text"
                  placeholder="Enter student full name"
                  value={editAppName}
                  onChange={e => setEditAppName(e.target.value)}
                  autoFocus
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="tel"
                    placeholder="10-digit mobile"
                    value={editAppPhone}
                    onChange={e => setEditAppPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    onKeyDown={e => e.key === 'Enter' && handleEditApp()}
                    className="w-full rounded-xl border border-slate-200 pl-9 pr-3.5 py-2.5 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                  />
                </div>
              </div>
              {editAppError && <p className="text-xs text-red-500">{editAppError}</p>}
              <div className="rounded-xl bg-indigo-50 px-3.5 py-2.5 text-xs text-indigo-700 leading-relaxed">
                This updates the student&apos;s app account. The login password stays unchanged.
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={closeEditAppModal}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors">
                  Cancel
                </button>
                <button onClick={handleEditApp} disabled={editingApp}
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm">
                  {editingApp ? <Loader2 size={14} className="animate-spin" /> : <Pencil size={14} />}
                  Update
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Register / Create Login Modal */}
      {regModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-500 to-teal-600 px-5 py-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/70">Create App Login</p>
                <p className="text-white font-bold text-sm mt-0.5 font-mono">{regModal.code}</p>
              </div>
              <button onClick={closeRegModal} className="text-white/70 hover:text-white transition-colors rounded-full p-1 hover:bg-white/10">
                <X size={18} />
              </button>
            </div>

            {regSuccess ? (
              <div className="p-6 text-center space-y-4">
                <div className="w-14 h-14 rounded-full bg-emerald-50 ring-1 ring-emerald-200 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-7 h-7 text-emerald-600" />
                </div>
                <div>
                  <p className="font-bold text-slate-800 text-base">Account Created!</p>
                  <p className="text-xs text-slate-400 mt-1">Share these login details with the student</p>
                </div>
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-left space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-semibold uppercase tracking-wide">User ID</span>
                    <span className="flex items-center gap-1 font-mono font-bold text-slate-800">{regSuccess.userId}<CopyButton value={regSuccess.userId} /></span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-semibold uppercase tracking-wide">Olympiad ID</span>
                    <span className="flex items-center gap-1 font-mono font-bold text-slate-800">{regModal.code}<CopyButton value={regModal.code} /></span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-semibold uppercase tracking-wide">Phone</span>
                    <span className="font-mono text-slate-600">{regPhone}</span>
                  </div>
                </div>
                <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5">
                  Student can now log in to the app using their phone number and password.
                </p>
                <button onClick={closeRegModal}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors shadow-sm">
                  Done
                </button>
              </div>
            ) : (
              <div className="p-5 space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Student Name</label>
                  <input
                    type="text" placeholder="Full name" value={regName}
                    onChange={e => setRegName(e.target.value)} autoFocus
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Phone Number</label>
                  <div className="relative">
                    <Phone size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="tel" placeholder="10-digit mobile" value={regPhone}
                      onChange={e => setRegPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      className="w-full rounded-xl border border-slate-200 pl-9 pr-3.5 py-2.5 text-sm focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Password</label>
                  <div className="relative">
                    <input
                      type={showRegPassword ? 'text' : 'password'}
                      placeholder="Min 6 characters"
                      value={regPassword}
                      onChange={e => setRegPassword(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleRegister()}
                      className="w-full rounded-xl border border-slate-200 pr-10 pl-3.5 py-2.5 text-sm focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all"
                    />
                    <button type="button" onClick={() => setShowRegPassword(v => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {showRegPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
                {regError && <p className="text-xs text-red-500">{regError}</p>}
                <div className="rounded-xl bg-emerald-50 px-3.5 py-2.5 text-xs text-emerald-700">
                  Account will be created on the app. Student can log in with their phone + password.
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={closeRegModal}
                    className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors">
                    Cancel
                  </button>
                  <button onClick={handleRegister} disabled={registering}
                    className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm">
                    {registering ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                    Create Login
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Allot Student Modal */}
      {allotOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-600 px-5 py-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/70">Allot Student</p>
                <p className="text-white font-bold text-sm mt-0.5">An Olympiad ID will be auto-assigned</p>
              </div>
              <button onClick={closeAllotModal} className="text-white/70 hover:text-white transition-colors rounded-full p-1 hover:bg-white/10">
                <X size={18} />
              </button>
            </div>

            {allotSuccess ? (
              <div className="p-6 text-center space-y-4">
                <div className="w-14 h-14 rounded-full bg-emerald-50 ring-1 ring-emerald-200 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-7 h-7 text-emerald-600" />
                </div>
                <div>
                  <p className="font-bold text-slate-800 text-base">Student Allotted!</p>
                  <p className="text-xs text-slate-400 mt-1">Share these login details with the student</p>
                </div>
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-left space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-semibold uppercase tracking-wide">Olympiad ID</span>
                    <span className="flex items-center gap-1 font-mono font-bold text-slate-800">{allotSuccess.code}<CopyButton value={allotSuccess.code} /></span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-semibold uppercase tracking-wide">User ID</span>
                    <span className="flex items-center gap-1 font-mono font-bold text-slate-800">{allotSuccess.userId}<CopyButton value={allotSuccess.userId} /></span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-semibold uppercase tracking-wide">Password</span>
                    <span className="flex items-center gap-1 font-mono font-bold text-slate-800">{allotSuccess.password}<CopyButton value={allotSuccess.password} /></span>
                  </div>
                </div>
                <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5">
                  Student can now log in to the app using their phone number and this password.
                </p>
                <div className="flex gap-2">
                  <button onClick={openAllotModal}
                    className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors">
                    Allot Another
                  </button>
                  <button onClick={closeAllotModal}
                    className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors shadow-sm">
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-5 space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Student Name</label>
                  <input
                    type="text" placeholder="Full name" value={allotName}
                    onChange={e => setAllotName(e.target.value)} autoFocus
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Class</label>
                  <select
                    value={allotClass} onChange={e => setAllotClass(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all bg-white"
                  >
                    <option value="">Select class</option>
                    {classes.map(cls => (
                      <option key={cls.code} value={cls.code}>{cls.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Phone Number</label>
                  <div className="relative">
                    <Phone size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="tel" placeholder="10-digit mobile" value={allotPhone}
                      onChange={e => setAllotPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      onKeyDown={e => e.key === 'Enter' && handleAllot()}
                      className="w-full rounded-xl border border-slate-200 pl-9 pr-3.5 py-2.5 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                    />
                  </div>
                </div>
                {allotError && <p className="text-xs text-red-500">{allotError}</p>}
                <div className="rounded-xl bg-indigo-50 px-3.5 py-2.5 text-xs text-indigo-700">
                  The next available Olympiad ID for this class will be assigned automatically, and a password will be generated for the student.
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={closeAllotModal}
                    className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors">
                    Cancel
                  </button>
                  <button onClick={handleAllot} disabled={allotting}
                    className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm">
                    {allotting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
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
