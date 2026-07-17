'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search, Loader2, ShieldCheck, Plus, X, Eye, EyeOff, ToggleLeft, ToggleRight, Trash2, AlertCircle, RefreshCw } from 'lucide-react';

interface Moderator {
  id: string;
  moderatorId: string;
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

export default function ManageModeratorsPage() {
  const [rows, setRows] = useState<Moderator[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const [resetModal, setResetModal] = useState<Moderator | null>(null);
  const [newPass, setNewPass] = useState('');
  const [showNewPass, setShowNewPass] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');

  useEffect(() => {
    fetch('/api/credentials/moderators', { headers: authHeaders() })
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
      r.moderatorId.toLowerCase().includes(q)
    );
  }, [rows, search]);

  const togglePass = (id: string) => {
    setVisiblePasswords(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleCreate = async () => {
    if (!name.trim() || !email.trim() || !password.trim()) { setFormError('All fields required'); return; }
    setSubmitting(true); setFormError('');
    try {
      const res = await fetch('/api/credentials/moderators', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setRows(prev => [{ ...data, isActive: true, plainPassword: password, createdAt: new Date().toISOString() }, ...prev]);
      setShowForm(false); setName(''); setEmail(''); setPassword('');
    } catch (e: any) {
      setFormError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (r: Moderator) => {
    setRows(prev => prev.map(x => x.id === r.id ? { ...x, isActive: !r.isActive } : x));
    await fetch(`/api/credentials/moderators/${r.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ isActive: !r.isActive }),
    });
  };

  const handleDelete = async (r: Moderator) => {
    if (!confirm(`Delete moderator ${r.name}? This cannot be undone.`)) return;
    const res = await fetch(`/api/credentials/moderators/${r.id}`, { method: 'DELETE', headers: authHeaders() });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.message || 'Failed to delete moderator');
      return;
    }
    setRows(prev => prev.filter(x => x.id !== r.id));
  };

  const openReset = (r: Moderator) => {
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
      const res = await fetch(`/api/credentials/moderators/${resetModal.id}/reset`, {
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

  const stats = { total: rows.length, active: rows.filter(r => r.isActive).length };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-medium text-[#004f9f]">Create Moderator</h1>
        <button onClick={() => { setShowForm(true); setFormError(''); }}
          className="inline-flex items-center gap-2 bg-[#004f9f] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#003d7a] transition-colors">
          <Plus size={15} /> Add Moderator
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Total Moderators', value: stats.total, color: 'bg-blue-50 text-[#004f9f]' },
          { label: 'Active', value: stats.active, color: 'bg-green-50 text-green-700' },
        ].map(c => (
          <div key={c.label} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${c.color}`}>
              <ShieldCheck size={18} />
            </div>
            <div>
              <p className={`text-2xl font-black ${c.color.split(' ')[1]}`}>{c.value}</p>
              <p className="text-xs text-gray-400">{c.label}</p>
            </div>
          </div>
        ))}
      </div>

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
            {rows.length === 0 ? 'No moderators yet. Add one to get started.' : 'No results found.'}
          </div>
        ) : (
          <div className="overflow-x-auto"><table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-gray-400">
                <th className="px-5 py-3 text-left text-[10px] font-bold uppercase">#</th>
                <th className="px-5 py-3 text-left text-[10px] font-bold uppercase">Moderator ID</th>
                <th className="px-5 py-3 text-left text-[10px] font-bold uppercase">Name</th>
                <th className="px-5 py-3 text-left text-[10px] font-bold uppercase">Email</th>
                <th className="px-5 py-3 text-left text-[10px] font-bold uppercase">Status</th>
                <th className="px-5 py-3 text-left text-[10px] font-bold uppercase">Password</th>
                <th className="px-5 py-3 text-left text-[10px] font-bold uppercase">Added</th>
                <th className="px-5 py-3 text-center text-[10px] font-bold uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => {
                const showPass = visiblePasswords.has(r.id);
                return (
                  <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3 text-gray-400 text-xs">{i + 1}</td>
                    <td className="px-5 py-3 font-mono font-bold text-[#004f9f] text-xs">{r.moderatorId}</td>
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
                    <td className="px-5 py-3 text-xs text-gray-400">
                      {new Date(r.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => openReset(r)} title="Reset password"
                          className="p-1.5 rounded-lg bg-[#004f9f]/5 text-[#004f9f] hover:bg-[#004f9f]/10 transition-colors">
                          <RefreshCw size={13} />
                        </button>
                        <button onClick={() => toggleActive(r)} title={r.isActive ? 'Deactivate' : 'Activate'}
                          className={`p-1.5 rounded-lg transition-colors ${r.isActive ? 'bg-green-50 text-green-600 hover:bg-green-100' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}>
                          {r.isActive ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                        </button>
                        <button onClick={() => handleDelete(r)}
                          className="p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
            <div className="bg-[#004f9f] px-5 py-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">New Moderator</p>
                <p className="text-white font-bold text-sm mt-0.5">Create Moderator Account</p>
              </div>
              <button onClick={() => setShowForm(false)} className="text-white/50 hover:text-white"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Full Name</label>
                <input type="text" placeholder="Moderator full name" value={name} onChange={e => setName(e.target.value)}
                  autoFocus autoComplete="off"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#004f9f]" />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Email</label>
                <input type="email" placeholder="moderator@example.com" value={email} onChange={e => setEmail(e.target.value)}
                  autoComplete="off"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#004f9f]" />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Password</label>
                <div className="relative">
                  <input type={showPass ? 'text' : 'password'} placeholder="Min 6 characters" value={password}
                    onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreate()}
                    autoComplete="new-password"
                    className="w-full pr-10 pl-3 border border-gray-200 rounded-lg py-2.5 text-sm focus:outline-none focus:border-[#004f9f]" />
                  <button type="button" onClick={() => setShowPass(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
              {formError && (
                <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  <AlertCircle size={13} /> {formError}
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <button onClick={() => setShowForm(false)}
                  className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-sm font-semibold rounded-lg hover:bg-gray-50">
                  Cancel
                </button>
                <button onClick={handleCreate} disabled={submitting}
                  className="flex-1 py-2.5 bg-[#004f9f] text-white text-sm font-bold rounded-lg hover:bg-[#003d7a] disabled:opacity-50 flex items-center justify-center gap-2">
                  {submitting ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {resetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
            <div className="bg-[#004f9f] px-5 py-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">Password Reset</p>
                <p className="text-white font-bold text-sm mt-0.5">{resetModal.name}</p>
                <p className="text-white/60 text-[11px]">{resetModal.moderatorId}</p>
              </div>
              <button onClick={() => setResetModal(null)} className="text-white/50 hover:text-white"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              {resetSuccess ? (
                <div className="space-y-3">
                  <div className="flex items-start gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                    <ShieldCheck size={15} className="mt-0.5 shrink-0" />
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
