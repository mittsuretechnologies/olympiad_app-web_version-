'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  UserPlus, Loader2, Search, Eye, EyeOff, ToggleLeft, ToggleRight, Trash2, KeyRound, Edit, X,
  AlertCircle, CheckCircle, Copy, Camera, ShieldCheck,
} from 'lucide-react';
import { authFetch } from '@/lib/swr';
import { MASTER_ADMIN_USERNAME_SUFFIX, handleFromName, isValidMasterAdminHandle, normalizeMasterAdminHandle } from '@/lib/masterAdmin';

interface MasterAdmin {
  id: string;
  username: string;
  name: string;
  email: string | null;
  mobile: string | null;
  jobTitle: string | null;
  avatar: string | null;
  isActive: boolean;
  plainPassword: string | null;
  createdAt: string;
}

const inputClass =
  'w-full h-11 px-4 border border-gray-200 rounded-lg text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-[#004f9f] focus:ring-2 focus:ring-[#004f9f]/10';
const labelClass = 'block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1.5';

function Avatar({ avatar, size = 36 }: { avatar: string | null; size?: number }) {
  if (avatar && avatar !== 'male' && avatar !== 'female') {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={avatar} alt="" style={{ width: size, height: size }} className="rounded-full object-cover flex-shrink-0 bg-gray-100" />;
  }
  return (
    <span style={{ width: size, height: size, fontSize: size * 0.55 }}
      className="rounded-full bg-[#004f9f]/10 flex items-center justify-center flex-shrink-0 leading-none">
      {avatar === 'female' ? '👩‍💼' : '👨‍💼'}
    </span>
  );
}

// Male / Female / Custom Photo picker — shared by the create card and edit modal.
function AvatarPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const isCustom = value !== 'male' && value !== 'female';

  const upload = async (file: File) => {
    setUploading(true); setError('');
    try {
      const form = new FormData();
      form.append('image', file);
      const res = await authFetch('/api/master-admins/avatar', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Upload failed');
      onChange(data.imageUrl);
    } catch (e: any) { setError(e.message); } finally { setUploading(false); }
  };

  const choice = (active: boolean) =>
    `flex items-center gap-2 h-11 px-4 rounded-lg border text-sm transition-colors ${active ? 'border-[#004f9f] border-2 text-gray-900 bg-white' : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'}`;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => onChange('male')} className={choice(value === 'male')}>
          <span className="text-xl leading-none">👨‍💼</span> Male
        </button>
        <button type="button" onClick={() => onChange('female')} className={choice(value === 'female')}>
          <span className="text-xl leading-none">👩‍💼</span> Female
        </button>
        <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
          className={`${choice(isCustom)} text-xs font-medium uppercase tracking-wider text-gray-500`}>
          {uploading ? <Loader2 size={14} className="animate-spin" /> : isCustom ? <Avatar avatar={value} size={24} /> : <Camera size={14} />}
          Custom Photo
        </button>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }} />
      </div>
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button type="button" title="Copy"
      onClick={() => { navigator.clipboard?.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="p-1.5 rounded-md text-gray-400 hover:text-[#004f9f] hover:bg-[#004f9f]/10 transition-colors">
      {copied ? <CheckCircle size={14} className="text-green-600" /> : <Copy size={14} />}
    </button>
  );
}

export default function MasterAdminsPage() {
  const [rows, setRows] = useState<MasterAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);

  // Create form
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [avatar, setAvatar] = useState('male');
  const [handle, setHandle] = useState('');
  // false = the username follows the Full Name; true once the admin edits it by hand.
  const [handleEdited, setHandleEdited] = useState(false);
  const [handleStatus, setHandleStatus] = useState<{ state: 'idle' | 'checking' | 'available' | 'taken' | 'invalid' | 'error'; suggestion?: string | null; message?: string }>({ state: 'idle' });
  const [recheck, setRecheck] = useState(0);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState('');

  // Credentials shown once after create / reset
  const [issued, setIssued] = useState<{ title: string; name: string; username: string; password: string } | null>(null);

  // Edit modal
  const [editTarget, setEditTarget] = useState<MasterAdmin | null>(null);
  const [edit, setEdit] = useState({ name: '', mobile: '', email: '', jobTitle: '', avatar: 'male' });
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState('');

  const [deleteTarget, setDeleteTarget] = useState<MasterAdmin | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  useEffect(() => {
    authFetch('/api/master-admins')
      .then(r => (r.ok ? r.json() : []))
      .then(d => setRows(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, []);

  const onNameChange = (value: string) => {
    setName(value);
    if (!handleEdited) setHandle(handleFromName(value));
  };

  const onHandleChange = (value: string) => {
    const next = value.toLowerCase().replace(/\s/g, '');
    setHandle(next);
    // Emptying the box hands it back to the Full Name.
    setHandleEdited(next !== '');
    if (next === '') setHandle(handleFromName(name));
  };

  // Live uniqueness check (debounced). An auto-filled username that's taken is
  // swapped for the next free one (rohan.sharma2, …); a hand-typed one is left
  // alone and the free alternative is offered instead.
  useEffect(() => {
    const h = normalizeMasterAdminHandle(handle);
    if (!h) { setHandleStatus({ state: 'idle' }); return; }
    if (!isValidMasterAdminHandle(h)) { setHandleStatus({ state: 'invalid' }); return; }
    setHandleStatus({ state: 'checking' });
    let cancelled = false;
    const t = setTimeout(() => {
      authFetch(`/api/master-admins/username-check?handle=${encodeURIComponent(h)}`)
        .then(async r => {
          const d = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(d.message || `Server error (${r.status})`);
          return d;
        })
        .then(d => {
          if (cancelled) return;
          if (d.available) setHandleStatus({ state: 'available' });
          else if (!handleEdited && d.suggestion) setHandle(d.suggestion);
          else setHandleStatus({ state: 'taken', suggestion: d.suggestion });
        })
        .catch((e: Error) => { if (!cancelled) setHandleStatus({ state: 'error', message: e.message }); });
    }, 350);
    return () => { cancelled = true; clearTimeout(t); };
  }, [handle, handleEdited, recheck]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r =>
      r.name.toLowerCase().includes(q) ||
      r.username.toLowerCase().includes(q) ||
      (r.email || '').toLowerCase().includes(q) ||
      (r.mobile || '').includes(q) ||
      (r.jobTitle || '').toLowerCase().includes(q));
  }, [rows, search]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    const h = normalizeMasterAdminHandle(handle);
    if (!name.trim()) return setFormError('Full name is required.');
    if (!isValidMasterAdminHandle(h)) return setFormError('Username must be 3–40 characters: lowercase letters and numbers, optionally joined by "." or "_" (e.g. rohan.sharma).');
    setCreating(true);
    try {
      const res = await authFetch('/api/master-admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, mobile, email, jobTitle, avatar, username: h }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Could not create Master Admin');
      setRows(prev => [data, ...prev]);
      setIssued({ title: 'Master Admin created', name: data.name, username: data.username, password: data.plainPassword });
      setName(''); setMobile(''); setEmail(''); setJobTitle(''); setAvatar('male'); setHandle(''); setHandleEdited(false);
    } catch (e: any) {
      setFormError(e.message);
      // Someone may have taken it since the last check — re-run it.
      setRecheck(n => n + 1);
    } finally { setCreating(false); }
  };

  const toggleActive = async (row: MasterAdmin) => {
    setBusyId(row.id);
    try {
      const res = await authFetch(`/api/master-admins/${row.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !row.isActive }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setRows(prev => prev.map(r => (r.id === row.id ? { ...r, isActive: data.isActive } : r)));
      showToast(data.isActive ? `${row.name} activated` : `${row.name} deactivated — they are signed out on their next request`);
    } catch (e: any) { showToast(e.message || 'Update failed'); } finally { setBusyId(null); }
  };

  const resetPassword = async (row: MasterAdmin) => {
    setBusyId(row.id);
    try {
      const res = await authFetch(`/api/master-admins/${row.id}/reset`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setRows(prev => prev.map(r => (r.id === row.id ? { ...r, plainPassword: data.plainPassword } : r)));
      setIssued({ title: 'Password reset', name: row.name, username: row.username, password: data.plainPassword });
    } catch (e: any) { showToast(e.message || 'Reset failed'); } finally { setBusyId(null); }
  };

  const openEdit = (row: MasterAdmin) => {
    setEditTarget(row);
    setEdit({ name: row.name, mobile: row.mobile || '', email: row.email || '', jobTitle: row.jobTitle || '', avatar: row.avatar || 'male' });
    setEditError('');
  };

  const saveEdit = async () => {
    if (!editTarget) return;
    setEditBusy(true); setEditError('');
    try {
      const res = await authFetch(`/api/master-admins/${editTarget.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(edit),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setRows(prev => prev.map(r => (r.id === editTarget.id ? { ...r, ...data } : r)));
      setEditTarget(null);
      showToast('Master Admin updated');
    } catch (e: any) { setEditError(e.message); } finally { setEditBusy(false); }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setBusyId(deleteTarget.id);
    try {
      const res = await authFetch(`/api/master-admins/${deleteTarget.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setRows(prev => prev.filter(r => r.id !== deleteTarget.id));
      showToast(`${deleteTarget.name} deleted`);
      setDeleteTarget(null);
    } catch (e: any) { showToast(e.message || 'Delete failed'); } finally { setBusyId(null); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-medium text-[#004f9f]">Master Admins</h1>
          <p className="text-sm text-gray-500 mt-1">
            Level-2 admins. They use this dashboard with only the modules you grant in{' '}
            <Link href="/dashboard/settings/permission-control" className="text-[#004f9f] font-semibold hover:underline">Permission Control</Link>.
          </p>
        </div>
      </div>

      {/* Create card */}
      <form onSubmit={handleCreate} className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 bg-gray-50/70 border-b border-gray-200">
          <div className="flex items-center gap-2.5 text-[#004f9f]">
            <UserPlus size={20} />
            <h2 className="text-base font-semibold">Create New Master Admin</h2>
          </div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#004f9f] bg-[#004f9f]/5 border border-[#004f9f]/20 rounded-md px-3 py-1">
            Auto Password
          </span>
        </div>

        <div className="p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-5">
            <div>
              <label className={labelClass}>Full Name <span className="text-red-500">*</span></label>
              <input className={inputClass} placeholder="e.g. Rohan Sharma" value={name} onChange={e => onNameChange(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Mobile No.</label>
              <input className={inputClass} placeholder="e.g. 9876543210" inputMode="numeric" maxLength={10}
                value={mobile} onChange={e => setMobile(e.target.value.replace(/\D/g, ''))} />
            </div>
            <div>
              <label className={labelClass}>Email</label>
              <input className={inputClass} type="email" placeholder="e.g. rohan@example.com" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Job Title</label>
              <input className={inputClass} placeholder="e.g. Manager" value={jobTitle} onChange={e => setJobTitle(e.target.value)} />
            </div>
          </div>

          <div>
            <label className={labelClass}>Profile Photo / Avatar</label>
            <AvatarPicker value={avatar} onChange={setAvatar} />
          </div>

          <div>
            <label className={labelClass}>Username <span className="text-red-500">*</span></label>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex flex-1 min-w-0">
                <input className={`${inputClass} rounded-r-none`} placeholder="e.g. rohan.sharma" autoCapitalize="none"
                  value={handle} onChange={e => onHandleChange(e.target.value)} />
                <span className="flex items-center h-11 px-4 text-sm text-gray-500 bg-gray-50 border border-l-0 border-gray-200 rounded-r-lg whitespace-nowrap">
                  {MASTER_ADMIN_USERNAME_SUFFIX}
                </span>
              </div>
              <button type="submit" disabled={creating || handleStatus.state === 'checking' || handleStatus.state === 'taken' || handleStatus.state === 'invalid'}
                className="flex items-center justify-center gap-2 h-11 px-6 bg-[#004f9f] text-white text-sm font-semibold rounded-lg hover:bg-[#003d7a] disabled:opacity-60 transition-colors whitespace-nowrap">
                {creating ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />} Create Master
              </button>
            </div>
            <div className="mt-1.5 min-h-[18px] text-xs">
              {handleStatus.state === 'idle' && !handle && <span className="text-gray-400">Full Name bharte hi username apne aap ban jaayega — chaho toh edit kar sakte ho.</span>}
              {handleStatus.state === 'checking' && <span className="flex items-center gap-1 text-gray-400"><Loader2 size={12} className="animate-spin" /> Checking…</span>}
              {handleStatus.state === 'available' && <span className="flex items-center gap-1 text-green-600"><CheckCircle size={12} /> {normalizeMasterAdminHandle(handle)}{MASTER_ADMIN_USERNAME_SUFFIX} available hai</span>}
              {handleStatus.state === 'error' && <span className="text-amber-700">Username check nahi ho paaya: {handleStatus.message}</span>}
              {handleStatus.state === 'invalid' && <span className="text-red-600">3–40 characters: lowercase letters / numbers, beech mein &quot;.&quot; ya &quot;_&quot; (e.g. rohan.sharma)</span>}
              {handleStatus.state === 'taken' && (
                <span className="flex flex-wrap items-center gap-1 text-red-600">
                  Ye username pehle se liya hua hai.
                  {handleStatus.suggestion && (
                    <button type="button" onClick={() => { setHandle(handleStatus.suggestion!); setHandleEdited(true); }}
                      className="font-semibold text-[#004f9f] hover:underline">
                      {handleStatus.suggestion}{MASTER_ADMIN_USERNAME_SUFFIX} use karo
                    </button>
                  )}
                </span>
              )}
            </div>
          </div>

          {formError && (
            <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
              <AlertCircle size={13} /> {formError}
            </div>
          )}
        </div>
      </form>

      {/* List */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-800">All Master Admins <span className="text-gray-400 font-normal">({rows.length})</span></p>
          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, username, email…"
              className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-[#004f9f]" />
          </div>
        </div>

        {loading ? (
          <div className="py-16 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-gray-300" /></div>
        ) : filtered.length === 0 ? (
          <p className="py-16 text-center text-sm text-gray-400">{rows.length === 0 ? 'No Master Admins yet — create the first one above.' : 'No matches.'}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-gray-400 border-b border-gray-100">
                  <th className="px-5 py-3 font-bold">Name</th>
                  <th className="px-5 py-3 font-bold">Username</th>
                  <th className="px-5 py-3 font-bold">Contact</th>
                  <th className="px-5 py-3 font-bold">Password</th>
                  <th className="px-5 py-3 font-bold">Status</th>
                  <th className="px-5 py-3 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(r => {
                  const shown = visiblePasswords.has(r.id);
                  return (
                    <tr key={r.id} className={r.isActive ? '' : 'bg-gray-50/60'}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar avatar={r.avatar} />
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-800 truncate">{r.name}</p>
                            {r.jobTitle && <p className="text-[11px] text-gray-400 truncate">{r.jobTitle}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1 font-mono text-xs text-gray-700">
                          {r.username} <CopyButton text={r.username} />
                        </div>
                      </td>
                      <td className="px-5 py-3 text-xs text-gray-600">
                        <p>{r.email || '—'}</p>
                        <p className="text-gray-400">{r.mobile || ''}</p>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1 font-mono text-xs text-gray-700">
                          {r.plainPassword ? (shown ? r.plainPassword : '••••••••') : '—'}
                          {r.plainPassword && (
                            <>
                              <button type="button" title={shown ? 'Hide' : 'Show'} className="p-1.5 rounded-md text-gray-400 hover:text-gray-600"
                                onClick={() => setVisiblePasswords(prev => { const n = new Set(prev); if (n.has(r.id)) n.delete(r.id); else n.add(r.id); return n; })}>
                                {shown ? <EyeOff size={14} /> : <Eye size={14} />}
                              </button>
                              {shown && <CopyButton text={r.plainPassword} />}
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <button type="button" onClick={() => toggleActive(r)} disabled={busyId === r.id}
                          className={`flex items-center gap-1.5 text-xs font-bold ${r.isActive ? 'text-green-600' : 'text-gray-400'}`}>
                          {r.isActive ? <ToggleRight size={22} /> : <ToggleLeft size={22} />} {r.isActive ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Link href="/dashboard/settings/permission-control" title="Permissions"
                            className="p-2 rounded-lg text-gray-400 hover:text-[#004f9f] hover:bg-[#004f9f]/10"><ShieldCheck size={15} /></Link>
                          <button type="button" title="Edit" onClick={() => openEdit(r)}
                            className="p-2 rounded-lg text-gray-400 hover:text-[#004f9f] hover:bg-[#004f9f]/10"><Edit size={15} /></button>
                          <button type="button" title="Reset password" onClick={() => resetPassword(r)} disabled={busyId === r.id}
                            className="p-2 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50">
                            {busyId === r.id ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />}
                          </button>
                          <button type="button" title="Delete" onClick={() => setDeleteTarget(r)}
                            className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"><Trash2 size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Issued credentials (create / reset) */}
      {issued && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6 space-y-4">
            <div className="flex items-center gap-2 text-green-700">
              <CheckCircle size={20} /><h3 className="font-semibold">{issued.title}</h3>
            </div>
            <p className="text-sm text-gray-600">Share these login details with <b>{issued.name}</b>. They sign in on the normal dashboard login page.</p>
            <div className="space-y-2">
              {[['Username', issued.username], ['Password', issued.password]].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}</p>
                    <p className="font-mono text-sm text-gray-800 break-all">{value}</p>
                  </div>
                  <CopyButton text={value} />
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500">
              They see only the modules granted to Master Admins in{' '}
              <Link href="/dashboard/settings/permission-control" className="text-[#004f9f] font-semibold hover:underline">Permission Control</Link>.
            </p>
            <div className="flex justify-end">
              <button type="button" onClick={() => setIssued(null)}
                className="px-5 py-2 bg-[#004f9f] text-white text-sm font-semibold rounded-lg hover:bg-[#003d7a]">Done</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-[#004f9f]">Edit {editTarget.name}</h3>
              <button type="button" onClick={() => setEditTarget(null)} className="p-1 text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className={labelClass}>Full Name</label>
                <input className={inputClass} value={edit.name} onChange={e => setEdit(v => ({ ...v, name: e.target.value }))} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Mobile No.</label>
                  <input className={inputClass} inputMode="numeric" maxLength={10} value={edit.mobile}
                    onChange={e => setEdit(v => ({ ...v, mobile: e.target.value.replace(/\D/g, '') }))} />
                </div>
                <div>
                  <label className={labelClass}>Job Title</label>
                  <input className={inputClass} value={edit.jobTitle} onChange={e => setEdit(v => ({ ...v, jobTitle: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className={labelClass}>Email</label>
                <input className={inputClass} type="email" value={edit.email} onChange={e => setEdit(v => ({ ...v, email: e.target.value }))} />
              </div>
              <div>
                <label className={labelClass}>Profile Photo / Avatar</label>
                <AvatarPicker value={edit.avatar} onChange={a => setEdit(v => ({ ...v, avatar: a }))} />
              </div>
              <div>
                <label className={labelClass}>Username</label>
                <p className="font-mono text-sm text-gray-500">{editTarget.username} <span className="text-[11px] font-sans text-gray-400">(can&apos;t be changed)</span></p>
              </div>
              {editError && (
                <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                  <AlertCircle size={13} /> {editError}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100">
              <button type="button" onClick={() => setEditTarget(null)} className="px-4 py-2 text-sm font-semibold text-gray-600 rounded-lg hover:bg-gray-100">Cancel</button>
              <button type="button" onClick={saveEdit} disabled={editBusy}
                className="flex items-center gap-2 px-5 py-2 bg-[#004f9f] text-white text-sm font-semibold rounded-lg hover:bg-[#003d7a] disabled:opacity-60">
                {editBusy && <Loader2 size={14} className="animate-spin" />} Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-6 space-y-4">
            <h3 className="font-semibold text-gray-900">Delete {deleteTarget.name}?</h3>
            <p className="text-sm text-gray-600">
              <span className="font-mono">{deleteTarget.username}</span> will no longer be able to sign in. This can&apos;t be undone —
              to block access temporarily, set them Inactive instead. Their Activity Log entries are kept.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-sm font-semibold text-gray-600 rounded-lg hover:bg-gray-100">Cancel</button>
              <button type="button" onClick={confirmDelete} disabled={busyId === deleteTarget.id}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 disabled:opacity-60">
                {busyId === deleteTarget.id && <Loader2 size={14} className="animate-spin" />} Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-gray-900 text-white text-sm px-4 py-3 rounded-xl shadow-lg">{toast}</div>
      )}
    </div>
  );
}
