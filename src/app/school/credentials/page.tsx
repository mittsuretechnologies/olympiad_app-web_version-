'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  KeyRound, Loader2, Search, RotateCw, X,
  ChevronDown, ChevronRight, Eye, EyeOff, RefreshCw, CheckCircle, BookOpen
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

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
    <div className="space-y-4">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-[#0d9f6e] text-white px-4 py-3 rounded-xl shadow-lg text-sm font-semibold">
          <CheckCircle size={16} /> {toast}
        </div>
      )}

      {/* Header banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#4a3aa7] to-[#7a6ad6] p-6 text-white shadow-[0_8px_24px_rgba(74,58,167,0.25)]">
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/10" />
        <div className="absolute -bottom-14 right-24 w-28 h-28 rounded-full bg-white/10" />
        <div className="relative flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
            <KeyRound size={20} className="text-white" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-white/70">School Panel</p>
            <h1 className="text-xl font-black tracking-tight">Student Credentials</h1>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-[0_2px_14px_rgba(0,0,0,0.06)] border border-[#E7EBF2] overflow-hidden">
        {/* Toolbar */}
        <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-3 border-b border-[#E7EBF2]">
          <div className="flex items-center gap-4 text-sm">
            <span>
              <span className="text-gray-400">Classes: </span>
              <span className="font-bold text-[#1559C7]">{classes.length}</span>
            </span>
            <span className="text-gray-200">|</span>
            <span>
              <span className="text-gray-400">Allocated IDs: </span>
              <span className="font-bold text-[#1559C7]">{rows.length}</span>
            </span>
            <span className="text-gray-200">|</span>
            <span>
              <span className="text-gray-400">Registered: </span>
              <span className="font-bold text-[#0d9f6e]">{totalStudents}</span>
            </span>
          </div>
          <div className="flex items-center gap-2 flex-1 justify-end min-w-0 max-w-xl">
            <div className="relative flex-1 min-w-[220px] max-w-sm">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
              <input
                type="text"
                placeholder="Search class, student, Olympiad ID..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                autoComplete="off"
                className="w-full pl-9 pr-3 py-2 border border-[#E7EBF2] rounded-full text-[12px] focus:outline-none focus:border-[#1559C7] transition-colors"
              />
            </div>
            <button
              onClick={handleExpandAll}
              className="px-3 py-2 text-[11px] font-bold rounded-full bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors whitespace-nowrap"
            >
              {expandAll ? 'Collapse All' : 'Expand All'}
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-20 flex flex-col items-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-[#1559C7]" />
              <p className="text-sm text-gray-500">Loading credentials...</p>
            </div>
          ) : error ? (
            <div className="py-16 text-center text-red-600 text-sm">{error}</div>
          ) : classes.length === 0 ? (
            <div className="py-20 text-center text-gray-500 text-sm">
              {rows.length === 0 ? 'No Olympiad IDs allocated yet.' : 'No records match your search.'}
            </div>
          ) : (
            <table className="w-full text-sm border-collapse">
              <tbody>
                {classes.map((cls, ci) => {
                  const isOpen = expanded.has(cls.classCode);
                  const registered = cls.rows.filter(r => r.student).length;
                  const pending = cls.rows.length - registered;
                  return (
                    <React.Fragment key={cls.classCode}>
                      {/* Class header row */}
                      <tr
                        onClick={() => toggle(cls.classCode)}
                        className="cursor-pointer select-none bg-gradient-to-r from-[#1559C7]/5 to-transparent hover:from-[#1559C7]/10 transition-colors"
                      >
                        <td className="w-10 px-3 py-3 text-[#1559C7]">
                          {isOpen
                            ? <ChevronDown size={16} className="text-[#1559C7]" />
                            : <ChevronRight size={16} className="text-gray-400" />}
                        </td>
                        <td className="py-3 pr-4" colSpan={7}>
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <div className="w-7 h-7 rounded-lg bg-[#1559C7]/10 flex items-center justify-center flex-shrink-0">
                              <BookOpen size={13} className="text-[#1559C7]" />
                            </div>
                            <span className="text-[12.5px] font-bold text-black uppercase tracking-wide">{cls.label}</span>
                            <span className="text-[10px] text-gray-500 font-mono bg-gray-100 rounded-full px-2 py-0.5">{cls.rows.length} IDs</span>
                            <span className="ml-auto flex items-center gap-2 text-[11px]">
                              <span className="bg-[#0d9f6e]/10 text-[#0d9f6e] rounded-full px-2.5 py-1 font-bold">{registered} registered</span>
                              {pending > 0 && <span className="bg-[#d98600]/10 text-[#d98600] rounded-full px-2.5 py-1 font-bold">{pending} pending</span>}
                            </span>
                          </div>
                        </td>
                      </tr>

                      {/* Students sub-header */}
                      {isOpen && (
                        <tr className="bg-gray-50/70 text-gray-500">
                          <td className="w-10 px-3" />
                          <td className="px-3 py-2 text-[10.5px] font-bold uppercase tracking-wide w-8">#</td>
                          <td className="px-3 py-2 text-[10.5px] font-bold uppercase tracking-wide">Olympiad ID</td>
                          <td className="px-3 py-2 text-[10.5px] font-bold uppercase tracking-wide">Student Name</td>
                          <td className="px-3 py-2 text-[10.5px] font-bold uppercase tracking-wide">Phone</td>
                          <td className="px-3 py-2 text-[10.5px] font-bold uppercase tracking-wide">Username</td>
                          <td className="px-3 py-2 text-[10.5px] font-bold uppercase tracking-wide">Password</td>
                          <td className="px-3 py-2 text-[10.5px] font-bold uppercase tracking-wide text-center">Action</td>
                        </tr>
                      )}

                      {/* Student rows */}
                      {isOpen && cls.rows.map((r, ri) => (
                        <tr
                          key={r.id}
                          className={`border-t border-gray-50 ${ri % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'} hover:bg-[#1559C7]/[0.03] transition-colors`}
                        >
                          <td className="w-10 px-3" />
                          <td className="px-3 py-2.5 text-gray-400 text-xs">{ri + 1}</td>
                          <td className="px-3 py-2.5">
                            <span className="font-mono font-bold text-[#1559C7] text-sm select-all">{r.code}</span>
                          </td>
                          <td className="px-3 py-2.5 font-semibold text-black text-sm">
                            {r.student ? r.student.name : <span className="text-gray-300 font-normal">-</span>}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-xs text-gray-500">
                            {r.student ? r.student.phone : '-'}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-sm font-bold text-[#1559C7] select-all">
                            {r.student
                              ? r.student.username
                                ? r.student.username
                                : <span className="text-gray-300 italic text-xs">—</span>
                              : <span className="text-gray-300 italic text-xs">—</span>}
                          </td>
                          <td className="px-3 py-2.5">
                            {r.student ? (
                              r.student.plainPassword
                                ? <span className="font-mono font-bold text-[#1559C7] select-all text-sm">{r.student.plainPassword}</span>
                                : r.student.source === 'app'
                                  ? <span className="text-xs text-[#4a3aa7] font-semibold">App Login</span>
                                  : <span className="text-xs text-gray-300 italic">Reset to generate</span>
                            ) : '-'}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            {r.student ? (
                              <button
                                onClick={() => { setResetTarget(r); setResetAction('choose'); setCustomUsername(r.student?.username || ''); setCustomPassword(''); setShowPassword(false); }}
                                className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[#0d9f6e] text-white hover:bg-[#0b8a5e] transition-colors"
                                title="Edit credentials"
                              >
                                <RotateCw size={12} />
                              </button>
                            ) : (
                              <span className="text-gray-200">—</span>
                            )}
                          </td>
                        </tr>
                      ))}

                      {/* Spacing between classes */}
                      {ci < classes.length - 1 && (
                        <tr><td colSpan={8} className="h-1 bg-gray-50" /></tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {!loading && rows.length > 0 && (
          <div className="px-5 py-2.5 border-t border-gray-100 flex justify-between items-center text-[11px] text-gray-400 bg-gray-50/50">
            <span>Showing <span className="font-bold text-gray-600">{filtered.length}</span> of <span className="font-bold text-gray-600">{rows.length}</span> records</span>
            <span className="font-semibold">mittmee</span>
          </div>
        )}
      </div>

      {/* Reset Dialog */}
      <Dialog open={!!resetTarget} onOpenChange={open => { if (!open) closeDialog(); }}>
        <DialogContent className="max-w-sm p-0 border-0 rounded-2xl shadow-2xl overflow-hidden [&>button]:hidden">
          <DialogHeader className="sr-only"><DialogTitle>Edit Credentials</DialogTitle></DialogHeader>
          <div className="bg-gradient-to-r from-[#0d1a6e] to-[#1559C7] text-white px-5 py-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/60">
                {resetAction === 'choose' ? 'Edit Credentials' : resetAction === 'username' ? 'Change Username' : 'Set Password'}
              </p>
              {resetTarget?.student && <p className="text-white font-bold text-sm mt-0.5">{resetTarget.student.name} — <span className="font-mono">{resetTarget.code}</span></p>}
            </div>
            <button onClick={closeDialog} className="text-white/60 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
          </div>

          <div className="p-5 bg-white">

            {/* Choose */}
            {resetAction === 'choose' && (
              <div className="space-y-3">
                <p className="text-xs text-gray-400 mb-1">What do you want to change?</p>
                <button onClick={() => setResetAction('username')} className="w-full flex items-center gap-3 px-4 py-3 border border-[#E7EBF2] rounded-xl hover:border-[#0d9f6e] hover:bg-[#0d9f6e]/5 transition-all text-left">
                  <KeyRound size={18} className="text-[#0d9f6e] shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Change Username</p>
                    <p className="text-xs text-gray-400">Current: <span className="font-mono">{resetTarget?.student?.username || '—'}</span></p>
                  </div>
                </button>
                <button onClick={() => setResetAction('password')} className="w-full flex items-center gap-3 px-4 py-3 border border-[#E7EBF2] rounded-xl hover:border-[#0d9f6e] hover:bg-[#0d9f6e]/5 transition-all text-left">
                  <RotateCw size={18} className="text-[#0d9f6e] shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Set Password</p>
                    <p className="text-xs text-gray-400">Set a custom or auto-generated password</p>
                  </div>
                </button>
                <button onClick={closeDialog} className="w-full h-9 text-sm text-gray-400 hover:text-gray-600 transition-colors">Cancel</button>
              </div>
            )}

            {/* Username */}
            {resetAction === 'username' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">New Username</label>
                  <input
                    type="text"
                    value={customUsername}
                    onChange={e => { setCustomUsername(e.target.value.replace(/\s/g, '')); setUsernameError(''); }}
                    autoComplete="off"
                    className={`w-full rounded-xl border px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 ${usernameError ? 'border-red-400 focus:ring-red-300' : 'border-[#E7EBF2] focus:border-[#0d9f6e] focus:ring-[#0d9f6e]'}`}
                  />
                  {usernameError && <p className="text-xs text-red-500 mt-1">{usernameError}</p>}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setResetAction('choose')} className="flex-1 py-2.5 rounded-full border border-[#E7EBF2] text-gray-700 text-sm font-semibold hover:bg-gray-50 transition-colors">Back</button>
                  <button onClick={handleSave} disabled={resetBusy} className="flex-1 py-2.5 rounded-full bg-gradient-to-r from-[#0d9f6e] to-[#1baf7a] text-white text-sm font-bold hover:shadow-[0_4px_14px_rgba(13,159,110,0.35)] transition-shadow disabled:opacity-50">
                    {resetBusy ? 'Saving...' : 'Save Username'}
                  </button>
                </div>
              </div>
            )}

            {/* Password */}
            {resetAction === 'password' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">New Password</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={customPassword}
                        onChange={e => setCustomPassword(e.target.value)}
                        placeholder="Leave blank to auto-generate"
                        autoComplete="new-password"
                        className="w-full rounded-xl border border-[#E7EBF2] px-3 py-2 pr-9 text-sm font-mono focus:outline-none focus:border-[#0d9f6e] focus:ring-1 focus:ring-[#0d9f6e]"
                      />
                      <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                    <button type="button" onClick={() => { const c = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'; setCustomPassword(Array.from({length:10},()=>c[Math.floor(Math.random()*c.length)]).join('')); setShowPassword(true); }} className="rounded-xl px-3 border border-[#E7EBF2] text-gray-500 hover:bg-gray-50 transition-colors">
                      <RefreshCw size={14} />
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1">Leave blank to auto-generate.</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setResetAction('choose')} className="flex-1 py-2.5 rounded-full border border-[#E7EBF2] text-gray-700 text-sm font-semibold hover:bg-gray-50 transition-colors">Back</button>
                  <button onClick={handleSave} disabled={resetBusy} className="flex-1 py-2.5 rounded-full bg-gradient-to-r from-[#0d9f6e] to-[#1baf7a] text-white text-sm font-bold hover:shadow-[0_4px_14px_rgba(13,159,110,0.35)] transition-shadow disabled:opacity-50">
                    {resetBusy ? 'Saving...' : 'Save Password'}
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
