'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Contact, Loader2, Search, Download, Clock, BookOpen, ChevronDown, ChevronUp,
  UserPlus, Pencil, Trash2, CheckCircle, CheckCircle2, Phone, Mail, AlertCircle,
} from 'lucide-react';
import {
  CARD, STACK, TABLE, TH, TD, TR, INPUT, LABEL, FOCUS,
  BTN_PRIMARY, BTN_SECONDARY, BTN_SUBTLE, BTN_ICON,
} from '../ui';
import {
  PageHeader, StatTile, StatusBadge, FilterPill,
  LoadingState, ErrorState, EmptyState, ModalShell, RowCount,
} from '../components';

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

  /**
   * Allot modal. Opened from a specific row, so the Olympiad ID and class are
   * already known — the school only fills in the student's details. There is no
   * class picker and no separate "assign name first, register later" step.
   */
  const [allotRow, setAllotRow] = useState<Allocation | null>(null);
  const [allotName, setAllotName] = useState('');
  const [allotPhone, setAllotPhone] = useState('');
  const [allotEmail, setAllotEmail] = useState('');
  const [allotting, setAllotting] = useState(false);
  const [allotError, setAllotError] = useState('');
  const [allotSuccess, setAllotSuccess] = useState<{
    code: string; userId: string; password: string;
    email: string; emailSent: boolean; emailError: string | null;
  } | null>(null);

  // Edit app account modal (for ALLOTTED rows — name + phone)
  const [editAppModal, setEditAppModal] = useState<{ code: string } | null>(null);
  const [editAppName, setEditAppName] = useState('');
  const [editAppPhone, setEditAppPhone] = useState('');
  const [editingApp, setEditingApp] = useState(false);
  const [editAppError, setEditAppError] = useState('');

  const token = typeof window !== 'undefined' ? sessionStorage.getItem('schoolToken') : '';

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

  // Allot handlers — one flow, opened from the row whose ID is being filled.
  const openAllotModal = (row: Allocation) => {
    setAllotRow(row);
    setAllotName(row.assignedName || '');
    setAllotPhone('');
    setAllotEmail('');
    setAllotError('');
    setAllotSuccess(null);
  };
  const closeAllotModal = () => {
    setAllotRow(null); setAllotName(''); setAllotPhone(''); setAllotEmail('');
    setAllotError(''); setAllotSuccess(null);
  };

  const handleAllot = async () => {
    if (!allotRow) return;
    if (!allotName.trim()) { setAllotError('Student name is required'); return; }
    if (!allotPhone.trim() || allotPhone.trim().length < 10) { setAllotError('Valid phone number is required'); return; }
    if (allotEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(allotEmail.trim())) {
      setAllotError('Enter a valid email address'); return;
    }
    setAllotting(true); setAllotError('');
    try {
      // Registers against this exact code. The password is generated server-side
      // so the school never has to invent one.
      const res = await fetch(`/api/school/me/olympiad-ids/${allotRow.code}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: allotName.trim(),
          phone: allotPhone.trim(),
          email: allotEmail.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setAllocations(prev => prev.map(a =>
        a.code === allotRow.code
          ? { ...a, assignedName: allotName.trim(), assignedAt: new Date().toISOString(), hasAppUser: true, appUserPhone: allotPhone.trim() }
          : a
      ));
      setAllotSuccess({
        code: allotRow.code,
        userId: data.userId,
        password: data.password,
        email: allotEmail.trim(),
        emailSent: !!data.emailSent,
        emailError: data.emailError || null,
      });
    } catch (e: any) {
      setAllotError(e.message);
    } finally {
      setAllotting(false);
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

  /**
   * Counts respect the active class tab but not the status filter — a tile has
   * to keep showing its own total even while a different tile is selected,
   * otherwise the two unselected tiles would collapse to zero.
   */
  const stats = useMemo(() => {
    const inScope = activeClass === 'ALL'
      ? allocations
      : allocations.filter(a => (a.classCode || 'UNKNOWN') === activeClass);
    return {
      total: inScope.length,
      assigned: inScope.filter(a => a.assignedName).length,
      pending: inScope.filter(a => !a.assignedName).length,
    };
  }, [allocations, activeClass]);

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
    setCollapsedClasses(prev => {
      const n = new Set(prev);
      if (n.has(code)) n.delete(code); else n.add(code);
      return n;
    });
  };

  /** Status badge for one allocation row. Icon + text, never colour alone. */
  const renderStatus = (a: Allocation) => {
    if (a.student) return <StatusBadge tone="success" icon={CheckCircle2}>Registered</StatusBadge>;
    if (a.hasAppUser) return <StatusBadge tone="info" icon={CheckCircle}>Allotted</StatusBadge>;
    if (a.assignedName) return <StatusBadge tone="warning" icon={Clock}>Assigned</StatusBadge>;
    return <StatusBadge tone="neutral" icon={AlertCircle}>Pending</StatusBadge>;
  };

  return (
    <div className={STACK}>

      <PageHeader
        icon={Contact}
        title="Olympiad IDs"
        subtitle="Allot roll numbers to students"
        actions={
          <button onClick={exportCSV} disabled={filtered.length === 0} className={BTN_SUBTLE}>
            <Download size={13} /> Export
          </button>
        }
      />

      {/* Metrics — each tile is the filter that produces its own count, so the
          number you are looking at and the rows below always agree. */}
      <div className="grid grid-cols-3 gap-3">
        <StatTile
          label="Total allotted" value={stats.total} icon={Contact} loading={loading}
          active={statusFilter === 'ALL'} onClick={() => setStatusFilter('ALL')}
        />
        <StatTile
          label="Assigned" value={stats.assigned} icon={CheckCircle2} loading={loading}
          active={statusFilter === 'ASSIGNED'} onClick={() => setStatusFilter('ASSIGNED')}
        />
        <StatTile
          label="Pending" value={stats.pending} icon={Clock} loading={loading}
          active={statusFilter === 'PENDING'} onClick={() => setStatusFilter('PENDING')}
        />
      </div>

      {/* Toolbar */}
      <div className={`${CARD} flex flex-wrap items-center gap-2 px-3 py-2.5`}>
        <div className="relative min-w-[190px] flex-1 max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" size={13} />
          <input
            type="text"
            placeholder="Search ID or name"
            aria-label="Search Olympiad IDs"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className={`${INPUT} pl-8`}
          />
        </div>

        {/* Status filtering lives on the stat tiles above — repeating it here
            would give the same control two places to disagree. */}
        {classes.length > 1 && (
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            {[{ code: 'ALL', name: 'All classes' }, ...classes].map(cls => (
              <FilterPill key={cls.code} active={activeClass === cls.code} onClick={() => setActiveClass(cls.code)}>
                {cls.name}
                <span className="ml-1 opacity-60">
                  {cls.code === 'ALL' ? allocations.length : allocations.filter(a => (a.classCode || 'UNKNOWN') === cls.code).length}
                </span>
              </FilterPill>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <LoadingState label="Loading records…" />
      ) : error ? (
        <ErrorState message={error} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Contact}
          title={allocations.length === 0 ? 'No Olympiad IDs allocated yet' : 'No records match your filters'}
          hint={allocations.length === 0 ? 'Contact your Mittsure coordinator to get IDs allocated.' : undefined}
        />
      ) : (
        <div className="space-y-3">
          {grouped.map(({ code, label, items }) => {
            const isCollapsed = collapsedClasses.has(code);
            const classAssigned = items.filter(a => a.assignedName).length;

            return (
              <div key={code} className={`${CARD} overflow-hidden`}>
                <button
                  onClick={() => toggleCollapse(code)}
                  aria-expanded={!isCollapsed}
                  className={`flex w-full items-center justify-between gap-3 border-b border-[#E4E8EE] bg-[#FAFBFC] px-3 py-2 transition-colors hover:bg-[#F3F5F8] ${FOCUS}`}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <BookOpen size={14} className="flex-shrink-0 text-[#6B7280]" />
                    <span className="truncate text-[13px] font-semibold text-[#0E2A5C]">{label}</span>
                    <span className="flex-shrink-0 rounded bg-[#EDF0F4] px-1.5 py-0.5 text-[11px] font-medium text-[#4B5563]">
                      {items.length} IDs
                    </span>
                  </span>
                  <span className="flex flex-shrink-0 items-center gap-2.5 text-[12px] text-[#6B7280]">
                    <span className="hidden sm:inline">{classAssigned}/{items.length} assigned</span>
                    {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                  </span>
                </button>

                {!isCollapsed && (
                  <div className="overflow-x-auto">
                    <table className={TABLE}>
                      <thead>
                        <tr>
                          <th className={`${TH} w-12`}>#</th>
                          <th className={`${TH} w-36`}>Olympiad ID</th>
                          <th className={TH}>Student name</th>
                          <th className={`${TH} w-32`}>Status</th>
                          <th className={`${TH} w-32 text-center`}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((a, idx) => (
                          <tr key={a.id} className={TR}>
                            <td className={`${TD} text-[#9CA3AF]`}>{idx + 1}</td>
                            <td className={`${TD} font-mono font-semibold text-[#1559C7]`}>{a.code}</td>
                            <td className={TD}>
                              {a.assignedName
                                ? <span className="font-medium text-[#111827]">{a.assignedName}</span>
                                : <span className="text-[#9CA3AF]">Not assigned</span>}
                            </td>
                            <td className={TD}>{renderStatus(a)}</td>
                            <td className={`${TD} text-center`}>
                              {a.student ? (
                                <span className="text-[#9CA3AF]">—</span>
                              ) : a.hasAppUser || a.assignedName ? (
                                <div className="flex items-center justify-center gap-1.5">
                                  <button onClick={() => openEditAppModal(a)} className={BTN_ICON} aria-label={`Edit details for ${a.code}`} title="Edit name & phone">
                                    <Pencil size={12} />
                                  </button>
                                  <button onClick={() => handleUnassign(a.code)} className={`${BTN_ICON} hover:!text-[#B91C1C]`} aria-label={`Remove assignment for ${a.code}`} title="Remove">
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => openAllotModal(a)}
                                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-[#D3DAE4] px-2.5 py-1 text-[11.5px] font-semibold text-[#374151] transition-colors hover:border-[#1559C7]/50 hover:bg-[#1559C7]/[0.04] hover:text-[#1559C7] ${FOCUS}`}
                                >
                                  <UserPlus size={11} /> Allot
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

          <p className="px-1 text-right text-[11.5px] text-[#6B7280]">
            <RowCount shown={filtered.length} total={allocations.length} noun="records" />
          </p>
        </div>
      )}

      {/* Allot modal — the single path for filling an Olympiad ID. The class and
          the code come from the row that was clicked, so neither is asked for. */}
      {allotRow && (
        <ModalShell
          eyebrow="Allot student"
          title={
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-mono">{allotRow.code}</span>
              {/* The class is the school's check that they opened the right
                  row, so it is a chip rather than muted trailing text. */}
              <span className="rounded-md bg-[#1559C7]/[0.10] px-2 py-0.5 text-[12px] font-semibold text-[#1559C7]">
                {allotRow.className || allotRow.classCode || 'Unknown class'}
              </span>
            </span>
          }
          onClose={closeAllotModal}
          maxWidth="max-w-sm"
        >
          {allotSuccess ? (
            <div className="space-y-4 p-5 text-center">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[#047857]/10">
                <CheckCircle2 className="h-6 w-6 text-[#047857]" />
              </div>
              <div>
                <p className="text-[14.5px] font-semibold text-[#111827]">Student allotted</p>
                <p className="mt-0.5 text-[12px] text-[#6B7280]">Share these login details with the student</p>
              </div>
              <dl className="space-y-1.5 rounded-lg border border-[#E4E8EE] bg-[#FAFBFC] p-3 text-left">
                {[
                  ['Olympiad ID', allotSuccess.code],
                  ['User ID', allotSuccess.userId],
                  ['Password', allotSuccess.password],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between gap-3 text-[12px]">
                    <dt className="text-[#6B7280]">{k}</dt>
                    <dd className="select-all font-mono font-semibold text-[#111827]">{v}</dd>
                  </div>
                ))}
              </dl>
              {allotSuccess.emailSent ? (
                <p className="flex items-start gap-1.5 rounded-lg bg-[#047857]/10 px-3 py-2 text-left text-[12px] text-[#047857]">
                  <CheckCircle2 size={13} className="mt-0.5 flex-shrink-0" />
                  Credentials emailed to {allotSuccess.email}.
                </p>
              ) : allotSuccess.email ? (
                <p className="flex items-start gap-1.5 rounded-lg bg-[#B91C1C]/10 px-3 py-2 text-left text-[12px] text-[#B91C1C]">
                  <AlertCircle size={13} className="mt-0.5 flex-shrink-0" />
                  Could not email credentials ({allotSuccess.emailError || 'mail error'}) — note them down and share manually.
                </p>
              ) : (
                <p className="rounded-lg bg-[#F6F7F9] px-3 py-2 text-left text-[12px] text-[#4B5563]">
                  No email was given — note these details down before closing.
                </p>
              )}
              <button onClick={closeAllotModal} className={`cursor-pointer ${BTN_PRIMARY} w-full`}>Done</button>
            </div>
          ) : (
            <div className="space-y-3 p-5">
              <div>
                <label htmlFor="allot-name" className={LABEL}>Student name <span className="text-[#B91C1C]">*</span></label>
                <input
                  id="allot-name" type="text" placeholder="Full name" value={allotName}
                  onChange={e => setAllotName(e.target.value)} autoFocus className={INPUT}
                />
              </div>
              <div>
                <label htmlFor="allot-phone" className={LABEL}>Phone number <span className="text-[#B91C1C]">*</span></label>
                <div className="relative">
                  <Phone size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
                  <input
                    id="allot-phone" type="tel" placeholder="10-digit mobile" value={allotPhone}
                    onChange={e => setAllotPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    onKeyDown={e => e.key === 'Enter' && handleAllot()}
                    className={`${INPUT} pl-8`}
                  />
                </div>
              </div>
              <div>
                <label htmlFor="allot-email" className={LABEL}>Email address</label>
                <div className="relative">
                  <Mail size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
                  <input
                    id="allot-email" type="email" placeholder="student@example.com" value={allotEmail}
                    onChange={e => setAllotEmail(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAllot()}
                    className={`${INPUT} pl-8`}
                  />
                </div>
                <p className="mt-1 text-[11.5px] text-[#6B7280]">Optional — credentials are emailed here if given.</p>
              </div>
              {allotError && (
                <p className="flex items-center gap-1.5 text-[12px] text-[#B91C1C]" role="alert">
                  <AlertCircle size={12} /> {allotError}
                </p>
              )}
              {/* Warm tint: this note tells the school something will happen
                  on submit, so it should read as a heads-up rather than as
                  another neutral panel. Line-height is snug rather than relaxed
                  — at two lines the block otherwise stands as tall as an input
                  field, which overstates a passive note. */}
              <p className="rounded-lg border border-[#FAEBBF] bg-[#FEF9E7] px-3 py-2 text-[12px] leading-snug text-[#713F12]">
                A login account and password are created automatically for this ID.
              </p>
              <div className="flex gap-2 pt-1">
                <button onClick={closeAllotModal} className={`cursor-pointer ${BTN_SECONDARY} flex-1`}>Cancel</button>
                <button onClick={handleAllot} disabled={allotting} className={`cursor-pointer ${BTN_PRIMARY} flex-1`}>
                  {allotting ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
                  Allot
                </button>
              </div>
            </div>
          )}
        </ModalShell>
      )}

      {/* Edit App Account Modal */}
      {editAppModal && (
        <ModalShell
          eyebrow="Edit student details"
          title={<span className="font-mono">{editAppModal.code}</span>}
          onClose={closeEditAppModal}
          maxWidth="max-w-sm"
        >
          <div className="space-y-3.5 p-5">
            <div>
              <label htmlFor="edit-name" className={LABEL}>Student name</label>
              <input
                id="edit-name" type="text" placeholder="Enter student full name"
                value={editAppName} onChange={e => setEditAppName(e.target.value)}
                autoFocus className={INPUT}
              />
            </div>
            <div>
              <label htmlFor="edit-phone" className={LABEL}>Phone number</label>
              <div className="relative">
                <Phone size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
                <input
                  id="edit-phone" type="tel" placeholder="10-digit mobile" value={editAppPhone}
                  onChange={e => setEditAppPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  onKeyDown={e => e.key === 'Enter' && handleEditApp()}
                  className={`${INPUT} pl-8`}
                />
              </div>
            </div>
            {editAppError && (
              <p className="flex items-center gap-1.5 text-[12px] text-[#B91C1C]" role="alert">
                <AlertCircle size={12} /> {editAppError}
              </p>
            )}
            <p className="rounded-lg border border-[#FAEBBF] bg-[#FEF9E7] px-3 py-2 text-[12px] leading-snug text-[#713F12]">
              This updates the student&apos;s app account. The login password stays unchanged.
            </p>
            <div className="flex gap-2">
              <button onClick={closeEditAppModal} className={`cursor-pointer ${BTN_SECONDARY} flex-1`}>Cancel</button>
              <button onClick={handleEditApp} disabled={editingApp} className={`cursor-pointer ${BTN_PRIMARY} flex-1`}>
                {editingApp ? <Loader2 size={14} className="animate-spin" /> : <Pencil size={14} />}
                Update
              </button>
            </div>
          </div>
        </ModalShell>
      )}
    </div>
  );
}
