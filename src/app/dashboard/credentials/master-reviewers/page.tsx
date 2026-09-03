'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search, Loader2, UserCheck, Plus, X, Eye, EyeOff, ToggleLeft, ToggleRight, Trash2, AlertCircle, KeyRound, RotateCw, CheckCircle, Edit, Mail } from 'lucide-react';
import { authFetch } from '@/lib/swr';

interface MasterReviewer {
  id: string;
  masterReviewerId: string;
  name: string;
  email: string;
  plainPassword: string | null;
  isActive: boolean;
  createdAt: string;
}

export default function MasterReviewersPage() {
  const [rows, setRows] = useState<MasterReviewer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());

  // Create modal
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Reset modal
  const [resetTarget, setResetTarget] = useState<MasterReviewer | null>(null);
  const [customPassword, setCustomPassword] = useState('');
  const [showNewPass, setShowNewPass] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Edit modal
  const [editTarget, setEditTarget] = useState<MasterReviewer | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState('');
  const [sendingId, setSendingId] = useState<string | null>(null);

  useEffect(() => {
    authFetch('/api/credentials/master-reviewers')
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
      r.masterReviewerId.toLowerCase().includes(q)
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

  const handleCreate = async () => {
    if (!name.trim() || !email.trim() || !password.trim()) { setFormError('All fields required'); return; }
    setSubmitting(true); setFormError('');
    try {
      const res = await authFetch('/api/credentials/master-reviewers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Failed to create master reviewer');
      setRows(prev => [{ ...data, plainPassword: password, isActive: true, createdAt: new Date().toISOString() }, ...prev]);
      setShowForm(false); setName(''); setEmail(''); setPassword('');
    } catch (e: any) {
      setFormError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Both mutations below update the table optimistically, so a failed request
  // has to roll the row back — otherwise the UI shows a change the server rejected.
  const toggleActive = async (r: MasterReviewer) => {
    const updated = { ...r, isActive: !r.isActive };
    setRows(prev => prev.map(x => x.id === r.id ? updated : x));
    const res = await authFetch(`/api/credentials/master-reviewers/${r.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !r.isActive }),
    });
    if (!res.ok) {
      setRows(prev => prev.map(x => x.id === r.id ? r : x));
      alert('Could not update this master reviewer. Please try again.');
    }
  };

  const handleDelete = async (r: MasterReviewer) => {
    if (!confirm(`Delete master reviewer ${r.name}? This cannot be undone.`)) return;
    const prevRows = rows;
    setRows(prev => prev.filter(x => x.id !== r.id));
    const res = await authFetch(`/api/credentials/master-reviewers/${r.id}`, { method: 'DELETE' });
    if (!res.ok) {
      setRows(prevRows);
      alert('Could not delete this master reviewer. Please try again.');
    }
  };

  const openEdit = (r: MasterReviewer) => {
    setEditTarget(r);
    setEditName(r.name);
    setEditEmail(r.email);
    setEditError('');
  };

  const handleSaveEdit = async () => {
    if (!editTarget) return;
    if (!editName.trim() || !editEmail.trim()) { setEditError('Name and email are required'); return; }
    setEditBusy(true); setEditError('');
    try {
      const res = await authFetch(`/api/credentials/master-reviewers/${editTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim(), email: editEmail.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Failed to update master reviewer');
      setRows(prev => prev.map(r => r.id === editTarget.id ? { ...r, name: data.name, email: data.email } : r));
      showToast(`Updated ${data.name}`);
      setEditTarget(null);
    } catch (e: any) {
      setEditError(e.message);
    } finally {
      setEditBusy(false);
    }
  };

  const handleSendEmail = async (r: MasterReviewer) => {
    if (!r.plainPassword) { alert('Reset the password before sending credentials.'); return; }
    setSendingId(r.id);
    try {
      const res = await authFetch(`/api/credentials/master-reviewers/${r.id}/send`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Failed to send email');
      showToast(`Credentials emailed to ${r.name}`);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSendingId(null);
    }
  };

  const handleReset = async () => {
    if (!resetTarget) return;
    setResetBusy(true);
    try {
      const res = await authFetch(`/api/credentials/master-reviewers/${resetTarget.id}/reset`, {
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

  const stats = { total: rows.length, active: rows.filter(r => r.isActive).length };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium text-[#004f9f]">Master Reviewer Credentials</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            These credentials are used on the separate Olympiad Checker portal — generate and manage them here only.
          </p>
        </div>
        <button
          onClick={() => { setShowForm(true); setFormError(''); }}
          className="inline-flex items-center gap-2 bg-[#004f9f] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#003d7a] transition-colors shrink-0"
        >
          <Plus size={15} /> Add Master Reviewer
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
            <UserCheck size={18} className="text-[#004f9f]" />
          </div>
          <div>
            <p className="text-2xl font-black text-[#004f9f]">{stats.total}</p>
            <p className="text-xs text-gray-400">Total Master Reviewers</p>
          </div>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
            <UserCheck size={18} className="text-green-600" />
          </div>
          <div>
            <p className="text-2xl font-black text-green-700">{stats.active}</p>
            <p className="text-xs text-gray-400">Active</p>
          </div>
        </div>
      </div>

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
            {rows.length === 0 ? 'No master reviewers yet. Add one to get started.' : 'No results match your search.'}
          </div>
        ) : (
          <div className="overflow-x-auto"><table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-gray-400">
                <th className="px-5 py-3 text-left text-[10px] font-bold uppercase">#</th>
                <th className="px-5 py-3 text-left text-[10px] font-bold uppercase">Master Reviewer ID</th>
                <th className="px-5 py-3 text-left text-[10px] font-bold uppercase">Name</th>
                <th className="px-5 py-3 text-left text-[10px] font-bold uppercase">Email</th>
                <th className="px-5 py-3 text-left text-[10px] font-bold uppercase">Password</th>
                <th className="px-5 py-3 text-left text-[10px] font-bold uppercase">Status</th>
                <th className="px-5 py-3 text-center text-[10px] font-bold uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => {
                const passVisible = visiblePasswords.has(r.id);
                return (
                  <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3 text-gray-400 text-xs">{i + 1}</td>
                    <td className="px-5 py-3 font-mono font-bold text-[#004f9f] text-xs">{r.masterReviewerId}</td>
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
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => openEdit(r)}
                          title="Edit"
                          className="p-1.5 rounded-lg text-[#004f9f] bg-blue-50 hover:bg-blue-100 transition-colors">
                          <Edit size={13} />
                        </button>
                        <button onClick={() => { setResetTarget(r); setCustomPassword(''); setShowNewPass(false); }}
                          title="Reset password"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold rounded-lg hover:bg-amber-100 transition-colors">
                          <RotateCw size={10} /> Reset
                        </button>
                        <button onClick={() => handleSendEmail(r)} disabled={sendingId === r.id} title="Email credentials"
                          className="p-1.5 rounded-lg text-purple-600 bg-purple-50 hover:bg-purple-100 transition-colors disabled:opacity-40">
                          {sendingId === r.id ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                        </button>
                        <button onClick={() => toggleActive(r)} title={r.isActive ? 'Deactivate' : 'Activate'}
                          className={`p-1.5 rounded-lg transition-colors ${r.isActive ? 'bg-green-50 text-green-600 hover:bg-green-100' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}>
                          {r.isActive ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                        </button>
                        <button onClick={() => handleDelete(r)} title="Delete"
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

      {/* Add Master Reviewer Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
            <div className="bg-[#004f9f] px-5 py-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">New Master Reviewer</p>
                <p className="text-white font-bold text-sm mt-0.5">Create Master Reviewer Account</p>
              </div>
              <button onClick={() => setShowForm(false)} className="text-white/50 hover:text-white"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Full Name</label>
                <input type="text" placeholder="Master reviewer full name" value={name} onChange={e => setName(e.target.value)} autoFocus
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#004f9f] focus:ring-1 focus:ring-[#004f9f]" />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Email</label>
                <input type="email" placeholder="masterreviewer@example.com" value={email} onChange={e => setEmail(e.target.value)} autoComplete="off"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#004f9f] focus:ring-1 focus:ring-[#004f9f]" />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Password</label>
                <div className="relative">
                  <input type={showPass ? 'text' : 'password'} placeholder="Min 6 characters" value={password} autoComplete="new-password"
                    onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreate()}
                    className="w-full pr-10 pl-3 border border-gray-200 rounded-lg py-2.5 text-sm focus:outline-none focus:border-[#004f9f] focus:ring-1 focus:ring-[#004f9f]" />
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
                  {submitting ? <Loader2 size={14} className="animate-spin" /> : <UserCheck size={14} />}
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
            <div className="bg-[#004f9f] px-5 py-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">Edit Master Reviewer</p>
                <p className="text-white font-bold text-sm mt-0.5">{editTarget.masterReviewerId}</p>
              </div>
              <button onClick={() => setEditTarget(null)} className="text-white/50 hover:text-white"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Full Name</label>
                <input type="text" value={editName} onChange={e => setEditName(e.target.value)} autoFocus
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#004f9f] focus:ring-1 focus:ring-[#004f9f]" />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Email</label>
                <input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} autoComplete="off"
                  onKeyDown={e => e.key === 'Enter' && handleSaveEdit()}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#004f9f] focus:ring-1 focus:ring-[#004f9f]" />
              </div>
              {editError && (
                <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  <AlertCircle size={13} /> {editError}
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <button onClick={() => setEditTarget(null)}
                  className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-sm font-semibold rounded-lg hover:bg-gray-50">
                  Cancel
                </button>
                <button onClick={handleSaveEdit} disabled={editBusy}
                  className="flex-1 py-2.5 bg-[#004f9f] text-white text-sm font-bold rounded-lg hover:bg-[#003d7a] disabled:opacity-50 flex items-center justify-center gap-2">
                  {editBusy ? <Loader2 size={14} className="animate-spin" /> : <Edit size={14} />}
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
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
