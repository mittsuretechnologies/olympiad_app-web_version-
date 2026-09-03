'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { fetcher, authFetch } from '@/lib/swr';
import { KeyRound, Loader2, Search, RotateCw, X, Eye, EyeOff, RefreshCw, CheckCircle, Plus, AlertCircle, UserPlus, Edit, Trash, AlertTriangle, ToggleLeft, ToggleRight, Mail } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface UploaderCred {
  id: string;
  uploaderId: string;
  name: string;
  email?: string;
  phone?: string;
  username: string;
  plainPassword?: string | null;
  status: string;
  updatedAt: string;
  createdAt: string;
}

export default function UploaderCredentialsPage() {
  const { data, isLoading: loading, mutate } = useSWR<UploaderCred[]>('/api/credentials/uploaders', fetcher);
  const rows: UploaderCred[] = Array.isArray(data) ? data : [];
  const [search, setSearch] = useState('');

  const [resetTarget, setResetTarget] = useState<UploaderCred | null>(null);
  const [resetAction, setResetAction] = useState<'choose' | 'password' | 'username'>('choose');
  const [resetBusy, setResetBusy] = useState(false);
  const [customPassword, setCustomPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [customUsername, setCustomUsername] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  // Create modal
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // Edit / toggle / delete
  const [editing, setEditing] = useState<UploaderCred | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editStatus, setEditStatus] = useState('ACTIVE');
  const [toggling, setToggling] = useState<UploaderCred | null>(null);
  const [deleting, setDeleting] = useState<UploaderCred | null>(null);
  const [busy, setBusy] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!search) return rows;
    const q = search.toLowerCase();
    return rows.filter(r =>
      r.name?.toLowerCase().includes(q) ||
      r.uploaderId?.toLowerCase().includes(q) ||
      r.username?.toLowerCase().includes(q) ||
      (r.email || '').toLowerCase().includes(q)
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

  const handleCreate = async () => {
    if (!newName.trim()) { setCreateError('Name is required'); return; }
    setCreating(true); setCreateError('');
    try {
      const res = await authFetch('/api/uploaders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), email: newEmail.trim(), phone: newPhone.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Failed to create uploader');
      mutate();
      setToast(`Uploader created — ID ${data.uploaderId}`);
      setTimeout(() => setToast(null), 3000);
      setShowForm(false); setNewName(''); setNewEmail(''); setNewPhone('');
    } catch (e: any) {
      setCreateError(e.message);
    } finally {
      setCreating(false);
    }
  };

  const openEdit = (u: UploaderCred) => {
    setEditing(u);
    setEditName(u.name);
    setEditEmail(u.email || '');
    setEditPhone(u.phone || '');
    setEditStatus(u.status);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setBusy(true);
    try {
      const res = await authFetch(`/api/uploaders/${editing.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName, email: editEmail, phone: editPhone, status: editStatus }),
      });
      if (res.ok) {
        setEditing(null);
        mutate();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.message || 'Failed to update');
      }
    } catch {
      alert('Network error');
    } finally {
      setBusy(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!toggling) return;
    setBusy(true);
    const newStatus = toggling.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      const res = await authFetch(`/api/uploaders/${toggling.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: toggling.name, email: toggling.email, phone: toggling.phone, status: newStatus }),
      });
      if (res.ok) {
        setToggling(null);
        mutate();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.message || 'Failed to update status');
      }
    } catch {
      alert('Network error');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      const res = await authFetch(`/api/uploaders/${deleting.id}`, { method: 'DELETE' });
      if (res.ok) {
        setDeleting(null);
        mutate();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.message || 'Failed to delete');
      }
    } catch {
      alert('Network error');
    } finally {
      setBusy(false);
    }
  };

  const handleSendEmail = async (r: UploaderCred) => {
    if (!r.plainPassword) { alert('Reset the password before sending credentials.'); return; }
    if (!r.email) { alert('No email on file for this uploader.'); return; }
    setSendingId(r.id);
    try {
      const res = await authFetch(`/api/credentials/uploaders/${r.id}/send`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Failed to send email');
      setToast(`Credentials emailed to ${r.name}`);
      setTimeout(() => setToast(null), 3000);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSendingId(null);
    }
  };

  const handleSave = async () => {
    if (!resetTarget) return;
    if (resetAction === 'username') {
      if (!customUsername.trim()) { setUsernameError('Username required'); return; }
    }
    setResetBusy(true);
    setUsernameError('');
    try {
      const body = resetAction === 'username'
        ? { action: 'username', username: customUsername.trim() }
        : { action: 'password', password: customPassword || undefined };

      const res = await authFetch(`/api/uploaders/${resetTarget.id}/reset`, {
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-medium text-[#004f9f]">Manage Uploader Credentials</h1>
        <button
          onClick={() => { setShowForm(true); setCreateError(''); }}
          className="inline-flex items-center gap-2 bg-[#004f9f] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#003d7a] transition-colors shrink-0"
        >
          <Plus size={15} /> Add Uploader
        </button>
      </div>
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-[#009846] text-white px-4 py-3 rounded-xl shadow-lg text-sm font-semibold">
          <CheckCircle size={16} />
          {toast}
        </div>
      )}
    <div className="bg-white border border-gray-300 shadow-sm">
      <div className="bg-gray-50 border-b border-gray-300 px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm">
          <span className="text-gray-600">Total Uploaders: </span>
          <span className="font-bold text-[#004f9f]">{rows.length}</span>
        </div>
        <div className="relative max-w-md flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Search by name, uploader ID, username, email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoComplete="off"
            className="w-full pl-9 pr-3 py-2 border border-gray-300 text-sm focus:outline-none focus:border-[#06013E] focus:ring-1 focus:ring-[#06013E]"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse min-w-[640px]">
          <thead>
            <tr className="bg-[#E8EAF6] border-b-2 border-[#06013E] text-[#004f9f]">
              <th className="px-4 py-3 text-left text-xs font-bold uppercase border-r border-gray-300 w-12">#</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase border-r border-gray-300">Uploader ID</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase border-r border-gray-300">Name</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase border-r border-gray-300">Username</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase border-r border-gray-300">Current Password</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase border-r border-gray-300">Email</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase border-r border-gray-300">Status</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase border-r border-gray-300">Updated</th>
              <th className="px-4 py-3 text-center text-xs font-bold uppercase w-32">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="py-16 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-[#004f9f] mb-2" /></td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={9} className="py-16 text-center text-gray-500 text-sm">{rows.length === 0 ? 'No uploaders registered yet.' : 'No matches.'}</td></tr>
            ) : (
              filtered.map((r, idx) => (
                <tr key={r.id} className={`border-b border-gray-200 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-yellow-50`}>
                  <td className="px-4 py-2.5 border-r border-gray-200 text-gray-400 text-xs">{idx + 1}</td>
                  <td className="px-4 py-2.5 border-r border-gray-200 font-mono text-xs text-gray-400">{r.uploaderId}</td>
                  <td className="px-4 py-2.5 border-r border-gray-200 text-sm text-gray-400">{r.name}</td>
                  <td className="px-4 py-2.5 border-r border-gray-200 font-mono font-bold text-[#004f9f]">{r.username}</td>
                  <td className="px-4 py-2.5 border-r border-gray-200">
                    {r.plainPassword
                      ? <span className="font-mono font-bold text-[#004f9f] select-all">{r.plainPassword}</span>
                      : <span className="text-xs text-gray-400 italic">Reset to generate</span>}
                  </td>
                  <td className="px-4 py-2.5 border-r border-gray-200 text-gray-400 text-xs">{r.email || '-'}</td>
                  <td className="px-4 py-2.5 border-r border-gray-200">
                    <span className={`inline-block px-2 py-0.5 text-[10px] font-bold uppercase ${r.status === 'ACTIVE' ? 'bg-green-100 text-green-800 border border-green-300' : 'bg-gray-100 text-gray-700 border border-gray-300'}`}>{r.status}</span>
                  </td>
                  <td className="px-4 py-2.5 border-r border-gray-200 text-gray-400 text-xs">{new Date(r.updatedAt).toLocaleDateString()}</td>
                  <td className="px-4 py-2.5 text-center">
                    <div className="inline-flex gap-1">
                      <button
                        title="Reset credentials"
                        onClick={() => { setResetTarget(r); setResetAction('choose'); setCustomUsername(r.username || ''); }}
                        className="p-1.5 text-[#009846] hover:bg-green-50 border border-transparent hover:border-green-200 transition-all"
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                      </button>
                      <button
                        title="Email credentials"
                        onClick={() => handleSendEmail(r)}
                        disabled={sendingId === r.id}
                        className="p-1.5 text-purple-600 hover:bg-purple-50 border border-transparent hover:border-purple-200 transition-all disabled:opacity-40"
                      >
                        {sendingId === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        title="Edit"
                        onClick={() => openEdit(r)}
                        className="p-1.5 text-[#004f9f] hover:bg-[#06013E]/10 border border-transparent hover:border-[#06013E]/20 transition-all"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        title={r.status === 'INACTIVE' ? 'Mark Active' : 'Mark Inactive'}
                        onClick={() => setToggling(r)}
                        className={`p-1.5 border border-transparent transition-all ${
                          r.status === 'INACTIVE'
                            ? 'text-green-600 hover:bg-green-50 hover:border-green-200'
                            : 'text-orange-500 hover:bg-orange-50 hover:border-orange-200'
                        }`}
                      >
                        {r.status === 'INACTIVE' ? <ToggleLeft className="w-3.5 h-3.5" /> : <ToggleRight className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        title="Delete"
                        onClick={() => setDeleting(r)}
                        className="p-1.5 text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition-all"
                      >
                        <Trash className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="bg-gray-50 border-t border-gray-300 px-6 py-2 text-xs text-gray-200 flex justify-between items-center">
        <span>Showing <span className="font-bold">{filtered.length}</span> of <span className="font-bold">{rows.length}</span></span>
        <span className="italic">© mittmee</span>
      </div>

      {/* Dialog */}
      <Dialog open={!!resetTarget} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="max-w-sm p-0 border-0 rounded-2xl shadow-2xl overflow-hidden">
          <DialogHeader className="sr-only"><DialogTitle>Edit Credentials</DialogTitle></DialogHeader>

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

            {/* Choose */}
            {resetAction === 'choose' && (
              <div className="space-y-3">
                <p className="text-xs text-gray-400 mb-3">What do you want to change?</p>
                <button onClick={() => setResetAction('username')} className="w-full flex items-center gap-3 px-4 py-3 border border-gray-200 rounded-xl hover:border-[#009846] hover:bg-green-50 transition-all text-left">
                  <KeyRound size={18} className="text-[#009846] shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Change Username</p>
                    <p className="text-xs text-gray-400">Current: <span className="font-mono">{resetTarget?.username || '-'}</span></p>
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
                  <button onClick={handleSave} disabled={resetBusy} className="flex-1 h-10 bg-[#009846] text-white text-sm font-semibold hover:bg-[#007a38] transition-colors disabled:opacity-50">
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
                  <button onClick={handleSave} disabled={resetBusy} className="flex-1 h-10 bg-[#009846] text-white text-sm font-semibold hover:bg-[#007a38] transition-colors disabled:opacity-50">
                    {resetBusy ? 'Saving...' : 'Save Password'}
                  </button>
                </div>
              </div>
            )}

          </div>
        </DialogContent>
      </Dialog>

      {/* Add Uploader Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
            <div className="bg-[#004f9f] px-5 py-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">New Uploader</p>
                <p className="text-white font-bold text-sm mt-0.5">Create Uploader Account</p>
              </div>
              <button onClick={() => setShowForm(false)} className="text-white/50 hover:text-white"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Full Name</label>
                <input type="text" placeholder="Uploader full name" value={newName} onChange={e => setNewName(e.target.value)} autoFocus
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#004f9f] focus:ring-1 focus:ring-[#004f9f]" />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Email</label>
                <input type="email" placeholder="uploader@example.com" value={newEmail} onChange={e => setNewEmail(e.target.value)} autoComplete="off"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#004f9f] focus:ring-1 focus:ring-[#004f9f]" />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Phone</label>
                <input type="tel" placeholder="10 digit mobile" value={newPhone} onChange={e => setNewPhone(e.target.value)} autoComplete="off"
                  onKeyDown={e => e.key === 'Enter' && handleCreate()}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#004f9f] focus:ring-1 focus:ring-[#004f9f]" />
              </div>
              <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-[11px] text-blue-900">
                Username &amp; password are auto-generated — visible in the table right after creation.
              </div>
              {createError && (
                <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  <AlertCircle size={13} /> {createError}
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <button onClick={() => setShowForm(false)}
                  className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-sm font-semibold rounded-lg hover:bg-gray-50">
                  Cancel
                </button>
                <button onClick={handleCreate} disabled={creating}
                  className="flex-1 py-2.5 bg-[#004f9f] text-white text-sm font-bold rounded-lg hover:bg-[#003d7a] disabled:opacity-50 flex items-center justify-center gap-2">
                  {creating ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-sm p-0 border-0 rounded-none shadow-2xl overflow-hidden [&>button]:hidden">
          <DialogHeader className="sr-only"><DialogTitle>Edit Uploader</DialogTitle></DialogHeader>
          <div className="bg-[#009846] text-white px-5 py-3 border-b-4 border-[#FF9000] flex items-center justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-wider">Edit Uploader</p>
              {editing && <p className="text-xs text-white/70 mt-0.5">{editing.uploaderId} — {editing.name}</p>}
            </div>
            <button onClick={() => setEditing(null)} className="text-white/70 hover:text-white"><X className="w-4 h-4" /></button>
          </div>
          {editing && (
            <form onSubmit={handleSaveEdit} className="p-5 space-y-3 bg-white">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Name <span className="text-red-500">*</span></label>
                <input type="text" value={editName} onChange={e => setEditName(e.target.value)} required autoComplete="off"
                  className="w-full h-10 border border-gray-300 px-3 text-sm focus:outline-none focus:border-[#009846] focus:ring-1 focus:ring-[#009846]" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Email</label>
                <input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} autoComplete="off"
                  className="w-full h-10 border border-gray-300 px-3 text-sm focus:outline-none focus:border-[#009846] focus:ring-1 focus:ring-[#009846]" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Phone</label>
                <input type="tel" value={editPhone} onChange={e => setEditPhone(e.target.value)} autoComplete="off"
                  className="w-full h-10 border border-gray-300 px-3 text-sm focus:outline-none focus:border-[#009846] focus:ring-1 focus:ring-[#009846]" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Status</label>
                <select value={editStatus} onChange={e => setEditStatus(e.target.value)}
                  className="w-full h-10 border border-gray-300 px-3 text-sm focus:outline-none focus:border-[#009846] focus:ring-1 focus:ring-[#009846]">
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setEditing(null)} disabled={busy}
                  className="flex-1 h-10 border border-gray-300 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50">
                  Cancel
                </button>
                <button type="submit" disabled={busy}
                  className="flex-1 h-10 bg-[#009846] text-white text-sm font-semibold hover:bg-[#007a38] transition-colors disabled:opacity-50">
                  {busy ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Toggle Status Dialog */}
      <Dialog open={!!toggling} onOpenChange={(open) => !open && setToggling(null)}>
        <DialogContent className="max-w-sm p-0 border border-gray-300 rounded-none shadow-lg overflow-hidden [&>button]:hidden">
          <DialogHeader className="sr-only"><DialogTitle>Change Uploader Status</DialogTitle></DialogHeader>
          <div className={`px-5 py-3 border-b-4 border-[#FF9000] flex items-center justify-between ${toggling?.status === 'INACTIVE' ? 'bg-[#009846]' : 'bg-orange-500'}`}>
            <div className="flex items-center gap-2 text-white">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm font-bold uppercase tracking-wider">
                {toggling?.status === 'INACTIVE' ? 'Activate Uploader' : 'Deactivate Uploader'}
              </span>
            </div>
            <button onClick={() => setToggling(null)} className="text-white/70 hover:text-white"><X className="w-4 h-4" /></button>
          </div>
          <div className="p-5 bg-white space-y-4">
            <p className="text-sm text-gray-600 leading-relaxed">
              {toggling?.status === 'INACTIVE'
                ? 'This uploader will be reactivated and will regain login access to the app.'
                : 'This uploader will be marked inactive and will lose login access to the app until reactivated.'}
            </p>
            {toggling && (
              <div className="bg-gray-50 border border-gray-200 px-4 py-3 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Uploader ID</span>
                  <span className="font-mono font-bold text-[#004f9f]">{toggling.uploaderId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Name</span>
                  <span className="font-semibold text-gray-900">{toggling.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Current Status</span>
                  <span className={`font-bold ${toggling.status === 'INACTIVE' ? 'text-red-600' : 'text-green-600'}`}>
                    {toggling.status === 'INACTIVE' ? 'Inactive' : 'Active'}
                  </span>
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => setToggling(null)} disabled={busy}
                className="flex-1 h-10 border border-gray-300 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50">
                Cancel
              </button>
              <button onClick={handleToggleStatus} disabled={busy}
                className={`flex-1 h-10 text-white text-sm font-semibold transition-colors disabled:opacity-50 ${
                  toggling?.status === 'INACTIVE'
                    ? 'bg-[#009846] hover:bg-[#007a38]'
                    : 'bg-orange-500 hover:bg-orange-600'
                }`}>
                {busy ? 'Updating...' : toggling?.status === 'INACTIVE' ? 'Yes, Activate' : 'Yes, Deactivate'}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent className="max-w-sm p-0 border-0 rounded-none shadow-2xl overflow-hidden [&>button]:hidden">
          <DialogHeader className="sr-only"><DialogTitle>Delete Uploader</DialogTitle></DialogHeader>
          <div className="bg-red-600 text-white px-5 py-3 border-b-4 border-red-800 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-wider">Delete Uploader</p>
              {deleting && <p className="text-xs text-white/70 mt-0.5">{deleting.name}</p>}
            </div>
            <button onClick={() => setDeleting(null)} className="text-white/70 hover:text-white"><X className="w-4 h-4" /></button>
          </div>
          <div className="p-5 bg-white space-y-4">
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 px-4 py-3 rounded-lg">
              <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">This will permanently remove the uploader and their login access.</p>
            </div>
            {deleting && (
              <div className="text-sm space-y-1.5 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
                <div className="flex justify-between">
                  <span className="text-gray-400">Uploader ID</span>
                  <span className="font-mono font-semibold text-gray-700">{deleting.uploaderId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Name</span>
                  <span className="font-semibold text-gray-700">{deleting.name}</span>
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => setDeleting(null)} disabled={busy}
                className="flex-1 h-10 border border-gray-300 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50">
                Cancel
              </button>
              <button onClick={handleDelete} disabled={busy}
                className="flex-1 h-10 bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-50">
                {busy ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </div>
  );
}

