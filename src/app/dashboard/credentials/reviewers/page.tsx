'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search, Loader2, KeyRound, Eye, EyeOff, RotateCw, CheckCircle, X } from 'lucide-react';
import { authFetch } from '@/lib/swr';

interface ReviewerCred {
  id: string;
  reviewerId: string;
  name: string;
  email: string;
  plainPassword: string | null;
  isActive: boolean;
  createdAt: string;
}

export default function ReviewerCredentialsPage() {
  const [rows, setRows] = useState<ReviewerCred[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());

  // Reset modal
  const [resetTarget, setResetTarget] = useState<ReviewerCred | null>(null);
  const [customPassword, setCustomPassword] = useState('');
  const [showNewPass, setShowNewPass] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    authFetch('/api/credentials/reviewers')
      .then(r => r.ok ? r.json() : [])
      .then(d => setRows(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!search) return rows;
    const q = search.toLowerCase();
    return rows.filter(r =>
      r.name.toLowerCase().includes(q) ||
      r.email.toLowerCase().includes(q) ||
      r.reviewerId.toLowerCase().includes(q)
    );
  }, [rows, search]);

  const togglePasswordVisible = (id: string) => {
    setVisiblePasswords(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleReset = async () => {
    if (!resetTarget) return;
    setResetBusy(true);
    try {
      const res = await authFetch(`/api/credentials/reviewers/${resetTarget.id}/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: customPassword || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Failed to reset password');
      setRows(prev => prev.map(r =>
        r.id === resetTarget.id ? { ...r, plainPassword: data.plainPassword } : r
      ));
      showToast(`Password reset for ${resetTarget.name}`);
      setResetTarget(null);
      setCustomPassword('');
    } catch (e: any) {
      showToast(e.message);
    } finally {
      setResetBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-medium text-[#004f9f]">Reviewer Credentials</h1>

      {/* Search */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm px-4 py-3">
        <div className="relative max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Search name, email, ID..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#004f9f]"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center text-gray-400 text-sm">
            {rows.length === 0 ? 'No reviewers found.' : 'No results match your search.'}
          </div>
        ) : (
          <div className="overflow-x-auto"><table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-gray-400">
                <th className="px-5 py-3 text-left text-[10px] font-bold uppercase">#</th>
                <th className="px-5 py-3 text-left text-[10px] font-bold uppercase">Reviewer ID</th>
                <th className="px-5 py-3 text-left text-[10px] font-bold uppercase">Name</th>
                <th className="px-5 py-3 text-left text-[10px] font-bold uppercase">Email</th>
                <th className="px-5 py-3 text-left text-[10px] font-bold uppercase">Password</th>
                <th className="px-5 py-3 text-left text-[10px] font-bold uppercase">Status</th>
                <th className="px-5 py-3 text-center text-[10px] font-bold uppercase">Reset</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => {
                const passVisible = visiblePasswords.has(r.id);
                return (
                  <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3 text-gray-400 text-xs">{i + 1}</td>
                    <td className="px-5 py-3 font-mono font-bold text-[#004f9f] text-xs">{r.reviewerId}</td>
                    <td className="px-5 py-3 font-semibold text-gray-800">{r.name}</td>
                    <td className="px-5 py-3 text-gray-500 text-xs">{r.email}</td>
                    <td className="px-5 py-3">
                      {r.plainPassword ? (
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-gray-700">
                            {passVisible ? r.plainPassword : '••••••••'}
                          </span>
                          <button onClick={() => togglePasswordVisible(r.id)}
                            className="text-gray-400 hover:text-gray-600 transition-colors">
                            {passVisible ? <EyeOff size={13} /> : <Eye size={13} />}
                          </button>
                        </div>
                      ) : (
                        <span className="text-gray-300 italic text-xs">not stored</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {r.isActive ? (
                        <span className="px-2 py-0.5 text-[10px] font-bold bg-green-50 text-green-700 border border-green-200 rounded-full">Active</span>
                      ) : (
                        <span className="px-2 py-0.5 text-[10px] font-bold bg-red-50 text-red-600 border border-red-200 rounded-full">Inactive</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <button onClick={() => { setResetTarget(r); setCustomPassword(''); setShowNewPass(false); }}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold rounded-lg hover:bg-amber-100 transition-colors">
                        <RotateCw size={10} /> Reset
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        )}
      </div>

      {/* Reset Modal */}
      {resetTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
            <div className="bg-amber-600 px-5 py-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">Reset Password</p>
                <p className="text-white font-bold text-sm mt-0.5">{resetTarget.name}</p>
              </div>
              <button onClick={() => setResetTarget(null)} className="text-white/50 hover:text-white"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">
                  New Password <span className="normal-case text-gray-300">(leave blank to auto-generate)</span>
                </label>
                <div className="relative">
                  <input
                    type={showNewPass ? 'text' : 'password'}
                    placeholder="Enter new password or leave blank"
                    value={customPassword}
                    onChange={e => setCustomPassword(e.target.value)}
                    autoComplete="new-password"
                    className="w-full pr-10 pl-3 border border-gray-200 rounded-lg py-2.5 text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                  />
                  <button type="button" onClick={() => setShowNewPass(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showNewPass ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setResetTarget(null)}
                  className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-sm font-semibold rounded-lg hover:bg-gray-50">
                  Cancel
                </button>
                <button onClick={handleReset} disabled={resetBusy}
                  className="flex-1 py-2.5 bg-amber-600 text-white text-sm font-bold rounded-lg hover:bg-amber-700 disabled:opacity-50 flex items-center justify-center gap-2">
                  {resetBusy ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
                  Reset
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-gray-900 text-white px-4 py-3 rounded-xl shadow-xl text-sm font-medium">
          <CheckCircle size={15} className="text-green-400" />
          {toast}
        </div>
      )}
    </div>
  );
}
