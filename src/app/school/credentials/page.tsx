'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  KeyRound, Search, RotateCw, ChevronDown, ChevronRight,
  Eye, EyeOff, RefreshCw, CheckCircle2, BookOpen, Clock, AlertCircle,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  CARD, STACK, TABLE, TH, TD, TR, INPUT, LABEL, FOCUS,
  BTN_PRIMARY, BTN_SECONDARY, BTN_SUBTLE,
} from '../ui';
import {
  PageHeader, StatTile, StatusBadge,
  LoadingState, ErrorState, EmptyState, RowCount,
} from '../components';

interface StudentCred {
  id: string;
  code: string;
  classCode: string | null;
  className: string | null;
  student: {
    id: string; name: string; phone: string; username?: string | null;
    plainPassword?: string | null; isVerified: boolean; createdAt: string; source?: string;
  } | null;
}

interface ClassGroup {
  classCode: string;
  label: string;
  rows: StudentCred[];
}

export default function SchoolCredentialsPage() {
  const [rows, setRows] = useState<StudentCred[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [expandAll, setExpandAll] = useState(false);

  const [resetTarget, setResetTarget] = useState<StudentCred | null>(null);
  const [resetAction, setResetAction] = useState<'choose' | 'password' | 'username'>('choose');
  const [resetBusy, setResetBusy] = useState(false);
  const [customPassword, setCustomPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [customUsername, setCustomUsername] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  const token = typeof window !== 'undefined' ? sessionStorage.getItem('schoolToken') : '';

  const fetchCredentials = () => {
    if (!token) { setError('Not logged in'); setLoading(false); return; }
    fetch('/api/school/me/credentials', { headers: { Authorization: `Bearer ${token}` } })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to load');
        setRows(Array.isArray(data) ? data : []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchCredentials(); }, []);

  const filtered = useMemo(() => {
    if (!search) return rows;
    const q = search.toLowerCase();
    return rows.filter(r =>
      r.code?.toLowerCase().includes(q) ||
      r.className?.toLowerCase().includes(q) ||
      r.classCode?.toLowerCase().includes(q) ||
      r.student?.name?.toLowerCase().includes(q) ||
      r.student?.phone?.toLowerCase().includes(q) ||
      r.student?.username?.toLowerCase().includes(q)
    );
  }, [rows, search]);

  const classes = useMemo<ClassGroup[]>(() => {
    const map = new Map<string, ClassGroup>();
    for (const r of filtered) {
      const key = r.classCode || '__no_class__';
      if (!map.has(key)) {
        map.set(key, {
          classCode: r.classCode || '-',
          label: r.className || r.classCode || 'Unknown',
          rows: [],
        });
      }
      map.get(key)!.rows.push(r);
    }
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [filtered]);

  const toggle = (classCode: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(classCode)) next.delete(classCode);
      else next.add(classCode);
      return next;
    });
  };

  const handleExpandAll = () => {
    if (expandAll) {
      setExpanded(new Set());
      setExpandAll(false);
    } else {
      setExpanded(new Set(classes.map(c => c.classCode)));
      setExpandAll(true);
    }
  };

  const closeDialog = () => {
    setResetTarget(null);
    setResetAction('choose');
    setCustomPassword('');
    setShowPassword(false);
    setCustomUsername('');
    setUsernameError('');
  };

  const handleSave = async () => {
    if (!resetTarget?.student) return;
    if (resetAction === 'username' && !customUsername.trim()) {
      setUsernameError('Username required');
      return;
    }
    setResetBusy(true);
    setUsernameError('');
    try {
      const source = resetTarget.student.source === 'app' ? 'app' : 'web';
      const body = resetAction === 'username'
        ? { action: 'username', username: customUsername.trim(), source }
        : { action: 'password', password: customPassword || undefined, source };

      const res = await fetch(`/api/school/me/credentials/${resetTarget.student.id}/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        if (resetAction === 'username') setUsernameError(data.message || 'Failed');
        else alert(data.message || 'Failed');
        return;
      }
      const msg = resetAction === 'username'
        ? `Username updated for ${resetTarget.student.name}`
        : `Password updated for ${resetTarget.student.name}`;
      closeDialog();
      fetchCredentials();
      setToast(msg);
      setTimeout(() => setToast(null), 3000);
    } catch { alert('Network error'); }
    finally { setResetBusy(false); }
  };

  const totalStudents = rows.filter(r => r.student).length;

  return (
    <div className={STACK}>
      {toast && (
        <div
          role="status"
          className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-lg bg-[#111827] px-4 py-2.5 text-[12.5px] font-medium text-white shadow-lg"
        >
          <CheckCircle2 size={15} className="text-[#4ADE80]" /> {toast}
        </div>
      )}

      <PageHeader
        icon={KeyRound}
        title="Student Credentials"
        subtitle="Usernames and passwords by class"
        actions={
          <button onClick={handleExpandAll} className={BTN_SUBTLE}>
            {expandAll ? 'Collapse all' : 'Expand all'}
          </button>
        }
      />

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-3">
        <StatTile label="Classes" value={classes.length} icon={BookOpen} loading={loading} />
        <StatTile label="Allocated IDs" value={rows.length} icon={KeyRound} loading={loading} />
        <StatTile label="Registered" value={totalStudents} icon={CheckCircle2} loading={loading} />
      </div>

      {/* Toolbar */}
      <div className={`${CARD} flex flex-wrap items-center gap-2 px-3 py-2.5`}>
        <div className="relative min-w-[220px] flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" size={13} />
          <input
            type="text"
            placeholder="Search class, student, Olympiad ID…"
            aria-label="Search credentials"
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoComplete="off"
            className={`${INPUT} pl-8`}
          />
        </div>
        {!loading && rows.length > 0 && (
          <p className="ml-auto text-[11.5px] text-[#6B7280]">
            <RowCount shown={filtered.length} total={rows.length} noun="records" />
          </p>
        )}
      </div>

      {/* Body */}
      {loading ? (
        <LoadingState label="Loading credentials…" />
      ) : error ? (
        <ErrorState message={error} />
      ) : classes.length === 0 ? (
        <EmptyState
          icon={KeyRound}
          title={rows.length === 0 ? 'No Olympiad IDs allocated yet' : 'No records match your search'}
        />
      ) : (
        <div className="space-y-3">
          {classes.map(cls => {
            const isOpen = expanded.has(cls.classCode);
            const registered = cls.rows.filter(r => r.student).length;
            const pending = cls.rows.length - registered;

            return (
              <div key={cls.classCode} className={`${CARD} overflow-hidden`}>
                <button
                  onClick={() => toggle(cls.classCode)}
                  aria-expanded={isOpen}
                  className={`flex w-full items-center justify-between gap-3 bg-[#FAFBFC] px-3 py-2 transition-colors hover:bg-[#F3F5F8] ${isOpen ? 'border-b border-[#E4E8EE]' : ''} ${FOCUS}`}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    {isOpen
                      ? <ChevronDown size={14} className="flex-shrink-0 text-[#1559C7]" />
                      : <ChevronRight size={14} className="flex-shrink-0 text-[#9CA3AF]" />}
                    <BookOpen size={14} className="flex-shrink-0 text-[#6B7280]" />
                    <span className="truncate text-[13px] font-semibold text-[#0E2A5C]">{cls.label}</span>
                    <span className="flex-shrink-0 rounded bg-[#EDF0F4] px-1.5 py-0.5 text-[11px] font-medium text-[#4B5563]">
                      {cls.rows.length} IDs
                    </span>
                  </span>
                  <span className="flex flex-shrink-0 items-center gap-1.5">
                    <StatusBadge tone="success" icon={CheckCircle2}>{registered} registered</StatusBadge>
                    {pending > 0 && <StatusBadge tone="warning" icon={Clock}>{pending} pending</StatusBadge>}
                  </span>
                </button>

                {isOpen && (
                  <div className="overflow-x-auto">
                    <table className={TABLE}>
                      <thead>
                        <tr>
                          <th className={`${TH} w-10`}>#</th>
                          <th className={`${TH} w-36`}>Olympiad ID</th>
                          <th className={TH}>Student name</th>
                          <th className={`${TH} w-32`}>Phone</th>
                          <th className={`${TH} w-36`}>Username</th>
                          <th className={`${TH} w-36`}>Password</th>
                          <th className={`${TH} w-20 text-center`}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cls.rows.map((r, ri) => (
                          <tr key={r.id} className={TR}>
                            <td className={`${TD} text-[#9CA3AF]`}>{ri + 1}</td>
                            <td className={`${TD} select-all font-mono font-semibold text-[#1559C7]`}>{r.code}</td>
                            <td className={`${TD} font-medium text-[#111827]`}>
                              {r.student ? r.student.name : <span className="font-normal text-[#9CA3AF]">—</span>}
                            </td>
                            <td className={`${TD} font-mono text-[#6B7280]`}>
                              {r.student ? r.student.phone : <span className="text-[#9CA3AF]">—</span>}
                            </td>
                            <td className={`${TD} select-all font-mono font-semibold text-[#1559C7]`}>
                              {r.student?.username || <span className="font-normal text-[#9CA3AF]">—</span>}
                            </td>
                            <td className={TD}>
                              {r.student ? (
                                r.student.plainPassword
                                  ? <span className="select-all font-mono font-semibold text-[#111827]">{r.student.plainPassword}</span>
                                  : r.student.source === 'app'
                                    ? <span className="text-[#6B7280]">App login</span>
                                    : <span className="text-[#9CA3AF]">Reset to generate</span>
                              ) : <span className="text-[#9CA3AF]">—</span>}
                            </td>
                            <td className={`${TD} text-center`}>
                              {r.student ? (
                                <button
                                  onClick={() => {
                                    setResetTarget(r); setResetAction('choose');
                                    setCustomUsername(r.student?.username || '');
                                    setCustomPassword(''); setShowPassword(false);
                                  }}
                                  aria-label={`Edit credentials for ${r.student.name}`}
                                  title="Edit credentials"
                                  className={`inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#D3DAE4] text-[#4B5563] transition-colors hover:bg-[#F6F7F9] hover:text-[#111827] ${FOCUS}`}
                                >
                                  <RotateCw size={12} />
                                </button>
                              ) : <span className="text-[#9CA3AF]">—</span>}
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

      {/* Reset Dialog */}
      <Dialog open={!!resetTarget} onOpenChange={open => { if (!open) closeDialog(); }}>
        <DialogContent className="max-w-sm overflow-hidden rounded-xl border-0 p-0 shadow-2xl">
          <DialogHeader className="border-b border-[#E4E8EE] px-5 py-4 text-left space-y-0">
            <p className="text-[11px] font-medium uppercase tracking-wide text-[#6B7280]">
              {resetAction === 'choose' ? 'Edit credentials' : resetAction === 'username' ? 'Change username' : 'Set password'}
            </p>
            <DialogTitle className="mt-0.5 text-[15px] font-semibold text-[#0E2A5C]">
              {resetTarget?.student
                ? <>{resetTarget.student.name} · <span className="font-mono text-[13px] text-[#6B7280]">{resetTarget.code}</span></>
                : 'Edit credentials'}
            </DialogTitle>
          </DialogHeader>

          <div className="p-5">
            {resetAction === 'choose' && (
              <div className="space-y-2">
                <button
                  onClick={() => setResetAction('username')}
                  className={`flex w-full items-center gap-3 rounded-lg border border-[#E4E8EE] px-3.5 py-3 text-left transition-colors hover:border-[#1559C7]/40 hover:bg-[#1559C7]/[0.03] ${FOCUS}`}
                >
                  <KeyRound size={16} className="flex-shrink-0 text-[#1559C7]" />
                  <span>
                    <span className="block text-[13px] font-semibold text-[#111827]">Change username</span>
                    <span className="block text-[11.5px] text-[#6B7280]">
                      Current: <span className="font-mono">{resetTarget?.student?.username || '—'}</span>
                    </span>
                  </span>
                </button>
                <button
                  onClick={() => setResetAction('password')}
                  className={`flex w-full items-center gap-3 rounded-lg border border-[#E4E8EE] px-3.5 py-3 text-left transition-colors hover:border-[#1559C7]/40 hover:bg-[#1559C7]/[0.03] ${FOCUS}`}
                >
                  <RotateCw size={16} className="flex-shrink-0 text-[#1559C7]" />
                  <span>
                    <span className="block text-[13px] font-semibold text-[#111827]">Set password</span>
                    <span className="block text-[11.5px] text-[#6B7280]">Custom or auto-generated</span>
                  </span>
                </button>
                <button onClick={closeDialog} className={`cursor-pointer ${BTN_SECONDARY} w-full`}>Cancel</button>
              </div>
            )}

            {resetAction === 'username' && (
              <div className="space-y-3.5">
                <div>
                  <label htmlFor="cred-username" className={LABEL}>New username</label>
                  <input
                    id="cred-username"
                    type="text"
                    value={customUsername}
                    onChange={e => { setCustomUsername(e.target.value.replace(/\s/g, '')); setUsernameError(''); }}
                    autoComplete="off"
                    className={`${INPUT} font-mono ${usernameError ? 'border-[#B91C1C]' : ''}`}
                  />
                  {usernameError && (
                    <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-[#B91C1C]">
                      <AlertCircle size={12} /> {usernameError}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setResetAction('choose')} className={`${BTN_SECONDARY} flex-1`}>Back</button>
                  <button onClick={handleSave} disabled={resetBusy} className={`cursor-pointer ${BTN_PRIMARY} flex-1`}>
                    {resetBusy ? 'Saving…' : 'Save username'}
                  </button>
                </div>
              </div>
            )}

            {resetAction === 'password' && (
              <div className="space-y-3.5">
                <div>
                  <label htmlFor="cred-password" className={LABEL}>New password</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        id="cred-password"
                        type={showPassword ? 'text' : 'password'}
                        value={customPassword}
                        onChange={e => setCustomPassword(e.target.value)}
                        placeholder="Leave blank to auto-generate"
                        autoComplete="new-password"
                        className={`${INPUT} pr-9 font-mono`}
                      />
                      <button
                        type="button" onClick={() => setShowPassword(v => !v)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#4B5563]"
                      >
                        {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                    <button
                      type="button"
                      aria-label="Generate random password"
                      onClick={() => {
                        const c = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
                        setCustomPassword(Array.from({ length: 10 }, () => c[Math.floor(Math.random() * c.length)]).join(''));
                        setShowPassword(true);
                      }}
                      className={`rounded-lg border border-[#D3DAE4] px-3 text-[#4B5563] transition-colors hover:bg-[#F6F7F9] ${FOCUS}`}
                    >
                      <RefreshCw size={14} />
                    </button>
                  </div>
                  <p className="mt-1 text-[11.5px] text-[#6B7280]">Leave blank to auto-generate.</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setResetAction('choose')} className={`${BTN_SECONDARY} flex-1`}>Back</button>
                  <button onClick={handleSave} disabled={resetBusy} className={`cursor-pointer ${BTN_PRIMARY} flex-1`}>
                    {resetBusy ? 'Saving…' : 'Save password'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
