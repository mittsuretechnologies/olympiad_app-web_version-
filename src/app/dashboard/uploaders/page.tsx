'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/swr';
import { UploadCloud, Loader2, Search, Edit, Trash, X, AlertTriangle, ToggleLeft, ToggleRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Uploader {
  id: string;
  uploaderId: string;
  name: string;
  email?: string;
  phone?: string;
  username: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export default function UploadersPage() {
  const { data, isLoading: loading, mutate } = useSWR<Uploader[]>('/api/uploaders', fetcher);
  const uploaders: Uploader[] = Array.isArray(data) ? data : [];
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Uploader | null>(null);
  const [deleting, setDeleting] = useState<Uploader | null>(null);
  const [toggling, setToggling] = useState<Uploader | null>(null);
  const [busy, setBusy] = useState(false);

  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editStatus, setEditStatus] = useState('ACTIVE');

  const load = () => mutate();

  const filtered = useMemo(() => {
    if (!search) return uploaders;
    const q = search.toLowerCase();
    return uploaders.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.uploaderId.toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (u.phone || '').toLowerCase().includes(q)
    );
  }, [uploaders, search]);

  const openEdit = (u: Uploader) => {
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
      const res = await fetch(`/api/uploaders/${editing.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName,
          email: editEmail,
          phone: editPhone,
          status: editStatus,
        }),
      });
      if (res.ok) {
        setEditing(null);
        load();
      } else {
        const data = await res.json();
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
      const res = await fetch(`/api/uploaders/${toggling.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: toggling.name,
          email: toggling.email,
          phone: toggling.phone,
          status: newStatus,
        }),
      });
      if (res.ok) {
        setToggling(null);
        load();
      } else {
        const data = await res.json();
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
      const res = await fetch(`/api/uploaders/${deleting.id}`, { method: 'DELETE' });
      if (res.ok) {
        setDeleting(null);
        load();
      } else {
        const data = await res.json();
        alert(data.message || 'Failed to delete');
      }
    } catch {
      alert('Network error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-medium text-[#004f9f]">Uploaders</h1>
    <div className="bg-white border border-gray-300 shadow-sm">
      <div className="bg-gray-50 border-b border-gray-300 px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm">
          <span className="text-gray-600">Total Uploaders: </span>
          <span className="font-bold text-[#004f9f]">{uploaders.length}</span>
        </div>
        <div className="relative max-w-md flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Search by name, uploader ID, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 text-sm focus:outline-none focus:border-[#06013E] focus:ring-1 focus:ring-[#06013E]"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-[#E8EAF6] border-b-2 border-[#06013E] text-[#004f9f]">
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider border-r border-gray-300 w-12">#</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider border-r border-gray-300">Uploader ID</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider border-r border-gray-300">Name</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider border-r border-gray-300">Email</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider border-r border-gray-300">Phone</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider border-r border-gray-300">Status</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider border-r border-gray-300">Created</th>
              <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider w-32">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="py-16 text-center">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#004f9f] mb-2" />
                  <p className="text-gray-600 text-sm">Loading uploaders...</p>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-16 text-center text-gray-500 text-sm">
                  {uploaders.length === 0
                    ? 'No uploaders registered yet.'
                    : 'No uploaders match your search.'}
                </td>
              </tr>
            ) : (
              filtered.map((u, idx) => {
                const inactive = u.status === 'INACTIVE';
                return (
                <tr
                  key={u.id}
                  className={`border-b border-gray-200 transition-colors ${
                    inactive
                      ? 'bg-red-50/60 opacity-60 hover:opacity-80'
                      : idx % 2 === 0 ? 'bg-white hover:bg-yellow-50' : 'bg-gray-50 hover:bg-yellow-50'
                  }`}
                >
                  <td className="px-4 py-2.5 border-r border-gray-200 text-gray-700 text-xs">{idx + 1}</td>
                  <td className="px-4 py-2.5 border-r border-gray-200">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-[#004f9f]">{u.uploaderId}</span>
                      {inactive && (
                        <span className="text-[9px] font-bold uppercase bg-red-100 text-red-600 border border-red-300 px-1.5 py-0.5 leading-none">
                          Inactive
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 border-r border-gray-200 font-semibold text-gray-900">{u.name}</td>
                  <td className="px-4 py-2.5 border-r border-gray-200 text-gray-700 text-xs">{u.email || '-'}</td>
                  <td className="px-4 py-2.5 border-r border-gray-200 text-gray-700 text-xs font-mono">{u.phone || '-'}</td>
                  <td className="px-4 py-2.5 border-r border-gray-200">
                    <span className={`inline-block px-2 py-0.5 text-[10px] font-bold uppercase ${
                      inactive
                        ? 'bg-red-100 text-red-700 border border-red-300'
                        : 'bg-green-100 text-green-800 border border-green-300'
                    }`}>
                      {inactive ? 'Inactive' : 'Active'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 border-r border-gray-200 text-gray-700 text-xs">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <div className="inline-flex gap-1">
                      <button
                        title="Edit"
                        onClick={() => openEdit(u)}
                        className="p-1.5 text-[#004f9f] hover:bg-[#06013E]/10 border border-transparent hover:border-[#06013E]/20 transition-all"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        title={inactive ? 'Mark Active' : 'Mark Inactive'}
                        onClick={() => setToggling(u)}
                        className={`p-1.5 border border-transparent transition-all ${
                          inactive
                            ? 'text-green-600 hover:bg-green-50 hover:border-green-200'
                            : 'text-orange-500 hover:bg-orange-50 hover:border-orange-200'
                        }`}
                      >
                        {inactive ? <ToggleLeft className="w-3.5 h-3.5" /> : <ToggleRight className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        title="Delete"
                        onClick={() => setDeleting(u)}
                        className="p-1.5 text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition-all"
                      >
                        <Trash className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="bg-gray-50 border-t border-gray-300 px-6 py-2 text-xs text-gray-200 flex justify-between items-center">
        <span>
          Showing <span className="font-bold">{filtered.length}</span> of{' '}
          <span className="font-bold">{uploaders.length}</span> uploaders
        </span>
        <span className="italic">Â© Mittsure Olympiad Portal</span>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-sm p-0 border-0 rounded-none shadow-2xl overflow-hidden [&>button]:hidden">
          <DialogHeader className="sr-only"><DialogTitle>Edit Uploader</DialogTitle></DialogHeader>
          <div className="bg-[#009846] text-white px-5 py-3 border-b-4 border-[#FF9000] flex items-center justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-wider">Edit Uploader</p>
              {editing && <p className="text-xs text-white/70 mt-0.5">{editing.uploaderId} â€” {editing.name}</p>}
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

