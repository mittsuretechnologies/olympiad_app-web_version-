'use client';

import React, { useMemo, useState } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/swr';
import {
  KeyRound, Loader2, Search, RotateCw, X,
  ChevronDown, ChevronRight, Eye, EyeOff, RefreshCw, CheckCircle, Building2
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface StudentCred {
  id: string;
  code: string;
  school: { id: string; schoolId: string; name: string; city: string | null } | null;
  student: {
    id: string; name: string; phone: string; username?: string | null;
    plainPassword?: string | null; isVerified: boolean; createdAt: string;
  } | null;
}

interface SchoolGroup {
  schoolId: string;
  name: string;
  city: string | null;
  dbId: string;
  rows: StudentCred[];
}

export default function StudentCredentialsPage() {
  const { data, isLoading: loading, mutate } = useSWR<StudentCred[]>('/api/credentials/students', fetcher);
  const rows: StudentCred[] = Array.isArray(data) ? data : [];

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

  const filtered = useMemo(() => {
    if (!search) return rows;
    const q = search.toLowerCase();
    return rows.filter(r =>
      r.code?.toLowerCase().includes(q) ||
      r.school?.name?.toLowerCase().includes(q) ||
      r.school?.schoolId?.toLowerCase().includes(q) ||
      r.school?.city?.toLowerCase().includes(q) ||
      r.student?.name?.toLowerCase().includes(q) ||
      r.student?.phone?.toLowerCase().includes(q)
    );
  }, [rows, search]);

  const schools = useMemo<SchoolGroup[]>(() => {
    const map = new Map<string, SchoolGroup>();
    for (const r of filtered) {
      const key = r.school?.schoolId || '__no_school__';
      if (!map.has(key)) {
        map.set(key, {
          schoolId: r.school?.schoolId || '-',
          name: r.school?.name || 'Unknown School',
          city: r.school?.city || null,
          dbId: r.school?.id || '',
          rows: [],
        });
      }
      map.get(key)!.rows.push(r);
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [filtered]);

  const toggle = (schoolId: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(schoolId)) next.delete(schoolId);
      else next.add(schoolId);
      return next;
    });
  };

  const handleExpandAll = () => {
    if (expandAll) {
      setExpanded(new Set());
      setExpandAll(false);
    } else {
      setExpanded(new Set(schools.map(s => s.schoolId)));
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
      const body = resetAction === 'username'
        ? { action: 'username', username: customUsername.trim() }
        : { action: 'password', password: customPassword || undefined };

      const res = await fetch(`/api/credentials/students/${resetTarget.student.id}/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      mutate();
      setToast(msg);
      setTimeout(() => setToast(null), 3000);
    } catch { alert('Network error'); }
    finally { setResetBusy(false); }
  };

  const totalStudents = rows.filter(r => r.student).length;

  return (
    <div className="bg-white border border-gray-300 shadow-sm">

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-[#009846] text-white px-4 py-3 rounded-xl shadow-lg text-sm font-semibold">
          <CheckCircle size={16} /> {toast}
        </div>
      )}

      {/* Header */}
      <div className="bg-[#009846] text-white px-6 py-3 flex items-center justify-between border-b-4 border-[#FF9000]">
        <div className="flex items-center gap-3">
          <KeyRound size={20} />
          <h1 className="text-base font-bold uppercase tracking-wider">Student Credentials</h1>
        </div>
        <div className="text-xs text-gray-200">School-wise Olympiad IDs &amp; passwords</div>
      </div>

      {/* Toolbar */}
      <div className="bg-gray-50 border-b border-gray-300 px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4 text-sm">
          <span>
            <span className="text-gray-500">Schools: </span>
            <span className="font-bold text-[#06013E]">{schools.length}</span>
          </span>
          <span className="text-gray-300">|</span>
          <span>
            <span className="text-gray-500">Allocated IDs: </span>
            <span className="font-bold text-[#06013E]">{rows.length}</span>
          </span>
          <span className="text-gray-300">|</span>
          <span>
            <span className="text-gray-500">Registered: </span>
            <span className="font-bold text-green-700">{totalStudents}</span>
          </span>
        </div>
        <div className="flex items-center gap-2 flex-1 justify-end min-w-0 max-w-xl">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
            <input
              type="text"
              placeholder="Search school, student, Olympiad ID..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoComplete="off"
              className="w-full pl-9 pr-3 py-2 border border-gray-300 text-sm focus:outline-none focus:border-[#06013E] focus:ring-1 focus:ring-[#06013E]"
            />
          </div>
          <button
            onClick={handleExpandAll}
            className="px-3 py-2 text-xs font-semibold border border-gray-300 bg-white text-gray-600 hover:bg-gray-100 transition-colors whitespace-nowrap"
          >
            {expandAll ? 'Collapse All' : 'Expand All'}
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="overflow-x-auto">
        {loading ? (
          <div className="py-16 text-center">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#06013E] mb-2" />
            <p className="text-gray-500 text-sm">Loading credentials...</p>
          </div>
        ) : schools.length === 0 ? (
          <div className="py-16 text-center text-gray-500 text-sm">
            {rows.length === 0 ? 'No student IDs allocated yet.' : 'No records match your search.'}
          </div>
        ) : (
          <table className="w-full text-sm border-collapse">
            <tbody>
              {schools.map((school, si) => {
                const isOpen = expanded.has(school.schoolId);
                const registered = school.rows.filter(r => r.student).length;
                const pending = school.rows.length - registered;
                return (
                  <React.Fragment key={school.schoolId}>
                    {/* School header row */}
                    <tr
                      onClick={() => toggle(school.schoolId)}
                      className="cursor-pointer select-none border-b border-gray-300 bg-[#E8EAF6] hover:bg-[#D9DCF3] transition-colors"
                    >
                      <td className="w-10 px-3 py-3 text-[#06013E]">
                        {isOpen
                          ? <ChevronDown size={16} className="text-[#06013E]" />
                          : <ChevronRight size={16} className="text-gray-500" />}
                      </td>
                      <td className="py-3 pr-4" colSpan={8}>
                        <div className="flex items-center gap-3 flex-wrap">
                          <Building2 size={15} className="text-[#06013E] shrink-0" />
                          <span className="font-bold text-[#06013E] text-sm">{school.name}</span>
                          <span className="font-mono text-xs text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5">{school.schoolId}</span>
                          {school.city && <span className="text-xs text-gray-500 bg-gray-100 border border-gray-200 px-2 py-0.5">{school.city}</span>}
                          <span className="ml-auto flex items-center gap-2 text-xs">
                            <span className="bg-green-100 text-green-800 border border-green-200 px-2 py-0.5 font-semibold">{registered} registered</span>
                            {pending > 0 && <span className="bg-orange-100 text-orange-700 border border-orange-200 px-2 py-0.5 font-semibold">{pending} pending</span>}
                            <span className="text-gray-500 font-medium">{school.rows.length} total</span>
                          </span>
                        </div>
                      </td>
                    </tr>

                    {/* Students sub-header */}
                    {isOpen && (
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <td className="w-10 px-3" />
                        <td className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400 border-r border-gray-200 w-8">#</td>
                        <td className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400 border-r border-gray-200">Olympiad ID</td>
                        <td className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400 border-r border-gray-200">Student Name</td>
                        <td className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400 border-r border-gray-200">Phone</td>
                        <td className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400 border-r border-gray-200">Username</td>
                        <td className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400 border-r border-gray-200">Password</td>
                        <td className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400 border-r border-gray-200">Status</td>
                        <td className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400 text-center">Action</td>
                      </tr>
                    )}

                    {/* Student rows */}
                    {isOpen && school.rows.map((r, ri) => (
                      <tr
                        key={r.id}
                        className={`border-b border-gray-100 ${ri % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'} hover:bg-yellow-50 transition-colors`}
                      >
                        <td className="w-10 px-3 border-l-4 border-l-[#009846]/30" />
                        <td className="px-3 py-2 text-gray-400 text-xs border-r border-gray-100 w-8">{ri + 1}</td>
                        <td className="px-3 py-2 border-r border-gray-100">
                          <span className="font-mono font-bold text-[#06013E] text-sm select-all">{r.code}</span>
                        </td>
                        <td className="px-3 py-2 border-r border-gray-100 font-semibold text-gray-800 text-sm">
                          {r.student ? r.student.name : <span className="text-gray-300">-</span>}
                        </td>
                        <td className="px-3 py-2 border-r border-gray-100 font-mono text-xs text-gray-400">
                          {r.student ? r.student.phone : '-'}
                        </td>
                        <td className="px-3 py-2 border-r border-gray-100 font-mono text-sm font-bold text-[#06013E] select-all">
                          {r.student
                            ? r.student.username
                              ? r.student.username
                              : <span className="text-gray-300 italic text-xs">—</span>
                            : <span className="text-gray-300 italic text-xs">—</span>}
                        </td>
                        <td className="px-3 py-2 border-r border-gray-100">
                          {r.student ? (
                            r.student.plainPassword
                              ? <span className="font-mono font-bold text-[#06013E] select-all text-sm">{r.student.plainPassword}</span>
                              : <span className="text-xs text-gray-300 italic">Reset to generate</span>
                          ) : '-'}
                        </td>
                        <td className="px-3 py-2 border-r border-gray-100">
                          {r.student ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-green-100 text-green-800 border border-green-200">Registered</span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-orange-50 text-orange-600 border border-orange-200">Pending</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {r.student ? (
                            <button
                              onClick={() => { setResetTarget(r); setResetAction('choose'); setCustomUsername(r.student?.username || ''); setCustomPassword(''); setShowPassword(false); }}
                              className="inline-flex items-center justify-center w-7 h-7 bg-[#009846] text-white hover:bg-[#007a38] transition-colors"
                              title="Reset password"
                            >
                              <RotateCw size={13} />
                            </button>
                          ) : (
                            <span className="text-gray-200">—</span>
                          )}
                        </td>
                      </tr>
                    ))}

                    {/* Spacing between schools */}
                    {si < schools.length - 1 && (
                      <tr><td colSpan={8} className="h-1 bg-gray-100" /></tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer */}
      <div className="bg-gray-50 border-t border-gray-300 px-6 py-2 text-xs text-gray-500 flex justify-end items-center">
        <span className="italic">© Mittsure Olympiad Portal</span>
      </div>

      {/* Reset Dialog */}
      <Dialog open={!!resetTarget} onOpenChange={open => { if (!open) closeDialog(); }}>
        <DialogContent className="max-w-sm p-0 border-0 rounded-none shadow-2xl overflow-hidden [&>button]:hidden">
          <DialogHeader className="sr-only"><DialogTitle>Edit Credentials</DialogTitle></DialogHeader>
          <div className="bg-[#009846] text-white px-5 py-3 border-b-4 border-[#FF9000] flex items-center justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-wider">
                {resetAction === 'choose' ? 'Edit Credentials' : resetAction === 'username' ? 'Change Username' : 'Set Password'}
              </p>
              {resetTarget?.student && <p className="text-xs text-white/70 mt-0.5">{resetTarget.student.name} — {resetTarget.code}</p>}
            </div>
            <button onClick={closeDialog} className="text-white/70 hover:text-white"><X className="w-4 h-4" /></button>
          </div>

          <div className="p-5 bg-white">

            {/* Choose */}
            {resetAction === 'choose' && (
              <div className="space-y-3">
                <p className="text-xs text-gray-400 mb-3">What do you want to change?</p>
                <button onClick={() => setResetAction('username')} className="w-full flex items-center gap-3 px-4 py-3 border border-gray-200 rounded-xl hover:border-[#009846] hover:bg-green-50 transition-all text-left">
                  <KeyRound size={18} className="text-[#009846] shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Change Username</p>
                    <p className="text-xs text-gray-400">Current: <span className="font-mono">{resetTarget?.student?.username || '—'}</span></p>
                  </div>
                </button>
                <button onClick={() => setResetAction('password')} className="w-full flex items-center gap-3 px-4 py-3 border border-gray-200 rounded-xl hover:border-[#009846] hover:bg-green-50 transition-all text-left">
                  <RotateCw size={18} className="text-[#009846] shrink-0" />
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
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">New Username</label>
                  <input
                    type="text"
                    value={customUsername}
                    onChange={e => { setCustomUsername(e.target.value.replace(/\s/g, '')); setUsernameError(''); }}
                    autoComplete="off"
                    className={`w-full h-10 border px-3 text-sm font-mono focus:outline-none focus:ring-1 ${usernameError ? 'border-red-400 focus:ring-red-300' : 'border-gray-300 focus:border-[#009846] focus:ring-[#009846]'}`}
                  />
                  {usernameError && <p className="text-xs text-red-500 mt-1">{usernameError}</p>}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setResetAction('choose')} className="flex-1 h-10 border border-gray-300 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-colors">Back</button>
                  <button onClick={handleSave} disabled={resetBusy} className="flex-1 h-10 bg-[#009846] text-white text-sm font-semibold hover:bg-[#007a38] disabled:opacity-50 transition-colors">
                    {resetBusy ? 'Saving...' : 'Save Username'}
                  </button>
                </div>
              </div>
            )}

            {/* Password */}
            {resetAction === 'password' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">New Password</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={customPassword}
                        onChange={e => setCustomPassword(e.target.value)}
                        placeholder="Leave blank to auto-generate"
                        autoComplete="new-password"
                        className="w-full h-10 border border-gray-300 px-3 pr-9 text-sm font-mono focus:outline-none focus:border-[#009846] focus:ring-1 focus:ring-[#009846]"
                      />
                      <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                    <button type="button" onClick={() => { const c = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'; setCustomPassword(Array.from({length:10},()=>c[Math.floor(Math.random()*c.length)]).join('')); setShowPassword(true); }} className="h-10 px-3 border border-gray-300 text-gray-500 hover:bg-gray-50 transition-colors">
                      <RefreshCw size={14} />
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1">Leave blank to auto-generate.</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setResetAction('choose')} className="flex-1 h-10 border border-gray-300 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-colors">Back</button>
                  <button onClick={handleSave} disabled={resetBusy} className="flex-1 h-10 bg-[#009846] text-white text-sm font-semibold hover:bg-[#007a38] disabled:opacity-50 transition-colors">
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
