'use client';

import { useEffect, useMemo, useState } from 'react';
import { UploadCloud, Loader2, Search, Edit, Trash } from 'lucide-react';
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
  const [uploaders, setUploaders] = useState<Uploader[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Uploader | null>(null);
  const [deleting, setDeleting] = useState<Uploader | null>(null);
  const [busy, setBusy] = useState(false);

  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editStatus, setEditStatus] = useState('ACTIVE');

  const load = () => {
    setLoading(true);
    fetch('/api/uploaders')
      .then((r) => r.json())
      .then((data) => setUploaders(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

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
    <div className="bg-white border border-gray-300 shadow-sm">
      <div className="bg-[#06013E] text-white px-6 py-3 flex items-center justify-between border-b-4 border-[#FF9000]">
        <div className="flex items-center gap-3">
          <UploadCloud size={20} />
          <h1 className="text-base font-bold uppercase tracking-wider">Uploaders</h1>
        </div>
        <div className="text-xs text-gray-300">Manage uploader accounts for the mobile app</div>
      </div>

      <div className="bg-gray-50 border-b border-gray-300 px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm">
          <span className="text-gray-600">Total Uploaders: </span>
          <span className="font-bold text-[#06013E]">{uploaders.length}</span>
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
            <tr className="bg-[#E8EAF6] border-b-2 border-[#06013E] text-[#06013E]">
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
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#06013E] mb-2" />
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
              filtered.map((u, idx) => (
                <tr
                  key={u.id}
                  className={`border-b border-gray-200 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-yellow-50 transition-colors`}
                >
                  <td className="px-4 py-2.5 border-r border-gray-200 text-gray-700 text-xs">{idx + 1}</td>
                  <td className="px-4 py-2.5 border-r border-gray-200 font-mono font-semibold text-[#06013E]">{u.uploaderId}</td>
                  <td className="px-4 py-2.5 border-r border-gray-200 font-semibold text-gray-900">{u.name}</td>
                  <td className="px-4 py-2.5 border-r border-gray-200 text-gray-700 text-xs">{u.email || '-'}</td>
                  <td className="px-4 py-2.5 border-r border-gray-200 text-gray-700 text-xs font-mono">{u.phone || '-'}</td>
                  <td className="px-4 py-2.5 border-r border-gray-200">
                    <span
                      className={`inline-block px-2 py-0.5 text-[10px] font-bold uppercase ${
                        u.status === 'ACTIVE'
                          ? 'bg-green-100 text-green-800 border border-green-300'
                          : 'bg-gray-100 text-gray-700 border border-gray-300'
                      }`}
                    >
                      {u.status}
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
                        className="p-1.5 text-[#06013E] hover:bg-[#06013E]/10 border border-transparent hover:border-[#06013E]/20 transition-all"
                      >
                        <Edit className="w-3.5 h-3.5" />
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
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="bg-gray-50 border-t border-gray-300 px-6 py-2 text-xs text-gray-600 flex justify-between items-center">
        <span>
          Showing <span className="font-bold">{filtered.length}</span> of{' '}
          <span className="font-bold">{uploaders.length}</span> uploaders
        </span>
        <span className="italic">© Mittsure Olympiad Portal</span>
      </div>

      {/* Edit Modal */}
      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="p-0 border border-gray-300 rounded-none sm:!max-w-lg w-[min(90vw,32rem)]">
          <div className="bg-[#06013E] text-white px-6 py-3 border-b-4 border-[#FF9000]">
            <DialogHeader>
              <DialogTitle className="text-base font-bold uppercase tracking-wider">
                Edit Uploader {editing?.uploaderId ? `(${editing.uploaderId})` : ''}
              </DialogTitle>
            </DialogHeader>
          </div>
          {editing && (
            <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#06013E] mb-1.5 uppercase">Name *</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                  className="w-full h-10 border border-gray-300 px-3 text-sm focus:outline-none focus:border-[#06013E] focus:ring-1 focus:ring-[#06013E]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#06013E] mb-1.5 uppercase">Email</label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full h-10 border border-gray-300 px-3 text-sm focus:outline-none focus:border-[#06013E] focus:ring-1 focus:ring-[#06013E]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#06013E] mb-1.5 uppercase">Phone</label>
                <input
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full h-10 border border-gray-300 px-3 text-sm focus:outline-none focus:border-[#06013E] focus:ring-1 focus:ring-[#06013E]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#06013E] mb-1.5 uppercase">Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="w-full h-10 border border-gray-300 px-3 text-sm focus:outline-none focus:border-[#06013E] focus:ring-1 focus:ring-[#06013E]"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  disabled={busy}
                  className="h-10 px-4 bg-white border border-gray-400 text-gray-700 font-semibold text-sm hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="h-10 px-5 bg-[#06013E] text-white font-semibold text-sm hover:bg-[#0a0660] disabled:opacity-50"
                >
                  {busy ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent className="max-w-md p-0 border-0 rounded-2xl shadow-2xl overflow-hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>Delete uploader</DialogTitle>
          </DialogHeader>
          <div className="bg-white px-7 pt-7 pb-6">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-4 ring-8 ring-red-50/40">
                <Trash className="w-7 h-7 text-red-600" strokeWidth={2.2} />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Delete this uploader?</h2>
              <p className="text-sm text-gray-500 max-w-xs">
                This will permanently remove the uploader and their login access.
              </p>
            </div>
            {deleting && (
              <div className="mt-5 bg-gray-50 rounded-xl p-4 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Uploader ID</span>
                  <span className="font-mono font-semibold">{deleting.uploaderId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Name</span>
                  <span className="font-semibold">{deleting.name}</span>
                </div>
              </div>
            )}
          </div>
          <div className="px-7 py-4 bg-gray-50 border-t border-gray-100 flex gap-3">
            <button
              onClick={() => setDeleting(null)}
              disabled={busy}
              className="flex-1 h-11 rounded-lg border border-gray-300 bg-white text-gray-700 font-semibold text-sm hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={busy}
              className="flex-1 h-11 rounded-lg bg-red-600 text-white font-semibold text-sm hover:bg-red-700 disabled:opacity-50"
            >
              {busy ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
