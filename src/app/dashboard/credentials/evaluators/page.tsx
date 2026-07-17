'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search, Loader2, Eye, EyeOff, RefreshCw, X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { authFetch } from '@/lib/swr';

interface Evaluator {
  id: string;
  evaluatorId: string;
  name: string;
  email: string;
  isActive: boolean;
  plainPassword: string | null;
  createdAt: string;
}

function authHeaders(): Record<string, string> {
  const token = sessionStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function EvaluatorCredentialsPage() {
  const [rows, setRows] = useState<Evaluator[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());

  const [resetModal, setResetModal] = useState<Evaluator | null>(null);
  const [newPass, setNewPass] = useState('');
  const [showNewPass, setShowNewPass] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');

  useEffect(() => {
    fetch('/api/credentials/evaluators', { headers: authHeaders() })
      .then(r => r.json())
      .then(d => setRows(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!search) return rows;
    const q = search.toLowerCase();
    return rows.filter(r =>
      r.name.toLowerCase().includes(q) ||
      r.email.toLowerCase().includes(q) ||
      r.evaluatorId.toLowerCase().includes(q)
    );
  }, [rows, search]);

  const togglePass = (id: string) => {
    setVisiblePasswords(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const openReset = (r: Evaluator) => {
    setResetModal(r);
    setNewPass('');
    setShowNewPass(false);
    setResetError('');
    setResetSuccess('');
  };

  const handleReset = async () => {
    if (!resetModal) return;
    setResetting(true); setResetError(''); setResetSuccess('');
    try {
      const res = await authFetch(`/api/credentials/evaluators/${resetModal.id}/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ password: newPass.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setRows(prev => prev.map(r => r.id === resetModal.id ? { ...r, plainPassword: data.plainPassword } : r));
      setResetSuccess(`Password reset to: ${data.plainPassword}`);
      setNewPass('');
    } catch (e: any) {
      setResetError(e.message);
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-medium text-[#004f9f]">Evaluator Credentials</h1>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm px-4 py-3">
        <div className="relative max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Search name, email, ID..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#004f9f]" />
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center text-gray-400 text-sm">
            {rows.length === 0 ? 'No evaluators found.' : 'No results found.'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-gray-400">
                <th className="px-5 py-3 text-left text-[10px] font-bold uppercase">#</th>
                <th className="px-5 py-3 text-left text-[10px] font-bold uppercase">Evaluator ID</th>
                <th className="px-5 py-3 text-left text-[10px] font-bold uppercase">Name</th>
                <th className="px-5 py-3 text-left text-[10px] font-bold uppercase">Email</th>
                <th className="px-5 py-3 text-left text-[10px] font-bold uppercase">Status</th>
                <th className="px-5 py-3 text-left text-[10px] font-bold uppercase">Password</th>
                <th className="px-5 py-3 text-center text-[10px] font-bold uppercase">Reset</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => {
                const showPass = visiblePasswords.has(r.id);
                return (
                  <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3 text-gray-400 text-xs">{i + 1}</td>
                    <td className="px-5 py-3 font-mono font-bold text-[#004f9f] text-xs">{r.evaluatorId}</td>
                    <td className="px-5 py-3 font-semibold text-gray-800">{r.name}</td>
                    <td className="px-5 py-3 text-gray-500 text-xs">{r.email}</td>
                    <td className="px-5 py-3">
                      {r.isActive
                        ? <span className="px-2 py-0.5 text-[10px] font-bold bg-green-50 text-green-700 border border-green-200 rounded-full">Active</span>
                        : <span className="px-2 py-0.5 text-[10px] font-bold bg-red-50 text-red-600 border border-red-200 rounded-full">Inactive</span>}
                    </td>
                    <td className="px-5 py-3">
                      {r.plainPassword ? (
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-gray-700">
                            {showPass ? r.plainPassword : '••••••••'}
                          </span>
                          <button onClick={() => togglePass(r.id)}
                            className="text-gray-400 hover:text-gray-600 transition-colors">
                            {showPass ? <EyeOff size={13} /> : <Eye size={13} />}
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-300 italic">hidden</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <button onClick={() => openReset(r)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase bg-[#004f9f]/5 text-[#004f9f] rounded-lg hover:bg-[#004f9f]/10 transition-colors">
                        <RefreshCw size={11} /> Reset
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {resetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
            <div className="bg-[#004f9f] px-5 py-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">Password Reset</p>
                <p className="text-white font-bold text-sm mt-0.5">{resetModal.name}</p>
                <p className="text-white/60 text-[11px]">{resetModal.evaluatorId}</p>
              </div>
              <button onClick={() => setResetModal(null)} className="text-white/50 hover:text-white"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              {resetSuccess ? (
                <div className="space-y-3">
                  <div className="flex items-start gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                    <CheckCircle2 size={15} className="mt-0.5 shrink-0" />
                    <span>{resetSuccess}</span>
                  </div>
                  <button onClick={() => setResetModal(null)}
                    className="w-full py-2.5 bg-[#004f9f] text-white text-sm font-bold rounded-lg hover:bg-[#003d7a]">
                    Done
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-xs text-gray-500">Enter a new password or leave blank to auto-generate one.</p>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">New Password</label>
                    <div className="relative">
                      <input type={showNewPass ? 'text' : 'password'} placeholder="Leave blank to auto-generate"
                        value={newPass} onChange={e => setNewPass(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleReset()}
                        autoComplete="new-password" autoFocus
                        className="w-full pr-10 pl-3 border border-gray-200 rounded-lg py-2.5 text-sm focus:outline-none focus:border-[#004f9f]" />
                      <button type="button" onClick={() => setShowNewPass(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {showNewPass ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>
                  {resetError && (
                    <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                      <AlertCircle size={13} /> {resetError}
                    </div>
                  )}
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => setResetModal(null)}
                      className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-sm font-semibold rounded-lg hover:bg-gray-50">
                      Cancel
                    </button>
                    <button onClick={handleReset} disabled={resetting}
                      className="flex-1 py-2.5 bg-[#004f9f] text-white text-sm font-bold rounded-lg hover:bg-[#003d7a] disabled:opacity-50 flex items-center justify-center gap-2">
                      {resetting ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                      Reset
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
