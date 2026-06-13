'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/swr';
import { KeyRound, Loader2, Search, RotateCw, X, Eye, EyeOff, RefreshCw, CheckCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface SchoolCred {
  id: string;
  schoolId: string;
  olympiadId?: string;
  name: string;
  email?: string;
  contactPerson?: string;
  username?: string;
  plainPassword?: string | null;
  updatedAt: string;
  createdAt: string;
}

export default function SchoolCredentialsPage() {
  const { data, isLoading: loading, mutate } = useSWR<SchoolCred[]>('/api/credentials/schools', fetcher);
  const rows: SchoolCred[] = Array.isArray(data) ? data : [];
  const [search, setSearch] = useState('');
  const [resetTarget, setResetTarget] = useState<SchoolCred | null>(null);
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
    return rows.filter(
      (r) =>
        r.name?.toLowerCase().includes(q) ||
        r.schoolId?.toLowerCase().includes(q) ||
        r.olympiadId?.toLowerCase().includes(q) ||
        r.username?.toLowerCase().includes(q) ||
        r.email?.toLowerCase().includes(q)
    );
  }, [rows, search]);

  const closeDialog = () => {
    setResetTarget(null);
    setResetAction('choose');
    setCustomPassword('');
    setShowPassword(false);
    setCustomUsername('');
    setUsernameError('');
  };

  const handleSave = async () => {
    if (!resetTarget) return;

    if (resetAction === 'username') {
      if (!customUsername.trim()) { setUsernameError('Username required'); return; }
      if (customUsername.trim().length > 10) { setUsernameError('Max 10 characters'); return; }
    }

    setResetBusy(true);
    setUsernameError('');
    try {
      const body = resetAction === 'username'
        ? { action: 'username', username: customUsername.trim() }
        : { action: 'password', password: customPassword || undefined };

      const res = await fetch(`/api/credentials/schools/${resetTarget.id}/reset`, {
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
        ? `Username updated for ${resetTarget.name}`
        : `Password updated for ${resetTarget.name}`;
      closeDialog();
      mutate();
      setToast(msg);
      setTimeout(() => setToast(null), 3000);
    } catch {
      alert('Network error');
    } finally {
      setResetBusy(false);
    }
  };


  return (
    <div className="bg-white border border-gray-300 shadow-sm">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-[#009846] text-white px-4 py-3 rounded-xl shadow-lg text-sm font-semibold animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle size={16} />
          {toast}
        </div>
      )}

      <div className="bg-[#009846] text-white px-6 py-3 flex items-center justify-between border-b-4 border-[#FF9000]">
        <div className="flex items-center gap-3">
          <KeyRound size={20} />
          <h1 className="text-base font-bold uppercase tracking-wider">Manage School Credentials</h1>
        </div>
        <div className="text-xs text-gray-200">Reset passwords and view login usernames</div>
      </div>

      <div className="bg-gray-50 border-b border-gray-300 px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm">
          <span className="text-gray-600">Total Schools: </span>
          <span className="font-bold text-[#06013E]">{rows.length}</span>
        </div>
        <div className="relative max-w-md flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Search by name, School ID, username, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoComplete="off"
            className="w-full pl-9 pr-3 py-2 border border-gray-300 text-sm focus:outline-none focus:border-[#06013E] focus:ring-1 focus:ring-[#06013E]"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-[#E8EAF6] border-b-2 border-[#06013E] text-[#06013E]">
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider border-r border-gray-300 w-12">#</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider border-r border-gray-300">School ID</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider border-r border-gray-300">CRM ID</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider border-r border-gray-300">School Name</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider border-r border-gray-300">Username</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider border-r border-gray-300">Current Password</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider border-r border-gray-300">Email</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider border-r border-gray-300">Last Updated</th>
              <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider w-40">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="py-16 text-center">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#06013E] mb-2" />
                  <p className="text-gray-600 text-sm">Loading credentials...</p>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-16 text-center text-gray-500 text-sm">
                  {rows.length === 0
                    ? 'No schools registered yet.'
                    : 'No schools match your search.'}
                </td>
              </tr>
            ) : (
              filtered.map((r, idx) => (
                <tr
                  key={r.id}
                  className={`border-b border-gray-200 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-yellow-50 transition-colors`}
                >
                  <td className="px-4 py-2.5 border-r border-gray-200 text-gray-400 text-xs">{idx + 1}</td>
                  <td className="px-4 py-2.5 border-r border-gray-200 font-mono text-xs text-gray-400">{r.schoolId}</td>
                  <td className="px-4 py-2.5 border-r border-gray-200 font-mono text-xs text-gray-400">{r.olympiadId || '-'}</td>
                  <td className="px-4 py-2.5 border-r border-gray-200 text-sm text-gray-400">{r.name}</td>
                  <td className="px-4 py-2.5 border-r border-gray-200 font-mono font-bold text-[#06013E]">{r.username || '-'}</td>
                  <td className="px-4 py-2.5 border-r border-gray-200">
                    {r.plainPassword ? (
                      <span className="font-mono text-sm font-bold text-[#06013E] select-all">
                        {r.plainPassword}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400 italic">Reset to generate</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 border-r border-gray-200 text-gray-400 text-xs">{r.email || '-'}</td>
                  <td className="px-4 py-2.5 border-r border-gray-200 text-gray-400 text-xs">
                    {new Date(r.updatedAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <button
                      title="Reset / generate new password"
                      onClick={() => { setResetTarget(r); setResetAction('choose'); setCustomUsername(r.username || ''); }}
                      className="inline-flex items-center justify-center w-8 h-8 bg-[#009846] text-white rounded hover:bg-[#007a38] transition-colors"
                    >
                      <RotateCw className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="bg-gray-50 border-t border-gray-300 px-6 py-2 text-xs text-gray-200 flex justify-between items-center">
        <span>
          Showing <span className="font-bold">{filtered.length}</span> of{' '}
          <span className="font-bold">{rows.length}</span> schools
        </span>
        <span className="italic">© Mittsure Olympiad Portal</span>
      </div>

      {/* Reset Dialog */}
      <Dialog open={!!resetTarget} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="max-w-sm p-0 border-0 rounded-2xl shadow-2xl overflow-hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>Edit Credentials</DialogTitle>
          </DialogHeader>

          {/* Header */}
          <div className="bg-[#009846] text-white px-5 py-3 border-b-4 border-[#FF9000] flex items-center justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-wider">
                {resetAction === 'choose' ? 'Edit Credentials' : resetAction === 'username' ? 'Change Username' : 'Set Password'}
              </p>
              {resetTarget && <p className="text-xs text-white/70 mt-0.5">{resetTarget.name}</p>}
            </div>
            <button onClick={closeDialog} className="text-white/70 hover:text-white"><X className="w-4 h-4" /></button>
          </div>

          <div className="p-5 bg-white">

            {/* Step 1 — Choose action */}
            {resetAction === 'choose' && (
              <div className="space-y-3">
                <p className="text-xs text-gray-400 mb-3">What do you want to change?</p>
                <button
                  onClick={() => setResetAction('username')}
                  className="w-full flex items-center gap-3 px-4 py-3 border border-gray-200 rounded-xl hover:border-[#009846] hover:bg-green-50 transition-all text-left"
                >
                  <KeyRound size={18} className="text-[#009846] shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Change Username</p>
                    <p className="text-xs text-gray-400">Current: <span className="font-mono">{resetTarget?.username || '-'}</span></p>
                  </div>
                </button>
                <button
                  onClick={() => setResetAction('password')}
                  className="w-full flex items-center gap-3 px-4 py-3 border border-gray-200 rounded-xl hover:border-[#009846] hover:bg-green-50 transition-all text-left"
                >
                  <RotateCw size={18} className="text-[#009846] shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Set Password</p>
                    <p className="text-xs text-gray-400">Set a custom or auto-generated password</p>
                  </div>
                </button>
                <button onClick={closeDialog} className="w-full h-9 text-sm text-gray-400 hover:text-gray-600 transition-colors">Cancel</button>
              </div>
            )}

            {/* Step 2a — Username */}
            {resetAction === 'username' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">New Username <span className="text-gray-300">(max 10 chars)</span></label>
                  <input
                    type="text"
                    maxLength={10}
                    value={customUsername}
                    onChange={e => { setCustomUsername(e.target.value.replace(/\s/g, '')); setUsernameError(''); }}
                    autoComplete="off"
                    className={`w-full h-10 border px-3 text-sm font-mono focus:outline-none focus:ring-1 ${usernameError ? 'border-red-400 focus:ring-red-300' : 'border-gray-300 focus:border-[#009846] focus:ring-[#009846]'}`}
                  />
                  {usernameError && <p className="text-xs text-red-500 mt-1">{usernameError}</p>}
                  <p className="text-[11px] text-gray-400 mt-1">{customUsername.length}/10 characters</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setResetAction('choose')} className="flex-1 h-10 border border-gray-300 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-colors">Back</button>
                  <button onClick={handleSave} disabled={resetBusy} className="flex-1 h-10 bg-[#009846] text-white text-sm font-semibold hover:bg-[#007a38] transition-colors disabled:opacity-50">
                    {resetBusy ? 'Saving...' : 'Save Username'}
                  </button>
                </div>
              </div>
            )}

            {/* Step 2b — Password */}
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
                    <button type="button" title="Generate random" onClick={() => { const c = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'; setCustomPassword(Array.from({length:10},()=>c[Math.floor(Math.random()*c.length)]).join('')); setShowPassword(true); }} className="h-10 px-3 border border-gray-300 text-gray-500 hover:bg-gray-50 transition-colors">
                      <RefreshCw size={14} />
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1">Leave blank to auto-generate.</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setResetAction('choose')} className="flex-1 h-10 border border-gray-300 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-colors">Back</button>
                  <button onClick={handleSave} disabled={resetBusy} className="flex-1 h-10 bg-[#009846] text-white text-sm font-semibold hover:bg-[#007a38] transition-colors disabled:opacity-50">
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
