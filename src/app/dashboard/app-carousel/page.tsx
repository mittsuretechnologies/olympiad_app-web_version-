'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Loader2, ImageIcon, Plus, X, Trash2, AlertCircle, ToggleLeft, ToggleRight,
  UploadCloud, GripVertical, Smartphone, Pencil, Link2, Info,
} from 'lucide-react';

interface AppBanner {
  id: string;
  image: string;
  alt: string;
  title: string;
  tag: string;
  linkUrl: string;
  order: number;
  isActive: boolean;
  createdAt: string;
}

function authHeaders(): Record<string, string> {
  const token = sessionStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// Reuses the landing-page banner upload endpoint — it's generic (takes an
// image, returns a hosted URL) and not coupled to BannerSlide rows.
async function uploadImage(file: File): Promise<string> {
  const fd = new FormData();
  fd.append('image', file);
  const res = await fetch('/api/dashboard/banners/upload', {
    method: 'POST',
    headers: authHeaders(),
    body: fd,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Upload failed');
  return data.imageUrl as string;
}

export default function AppCarouselPage() {
  const [rows, setRows] = useState<AppBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [image, setImage] = useState('');
  const [alt, setAlt] = useState('');
  const [title, setTitle] = useState('');
  const [tag, setTag] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const fileRef = useRef<HTMLInputElement>(null);
  const dragIndex = useRef<number | null>(null);
  const [reordering, setReordering] = useState(false);

  const load = () => {
    setLoading(true);
    setLoadError('');
    fetch('/api/dashboard/app-banners', { headers: authHeaders() })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.message || 'Failed to load slides');
        setRows(Array.isArray(data) ? data : []);
      })
      .catch((e) => setLoadError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const stats = useMemo(() => ({
    total: rows.length,
    active: rows.filter((r) => r.isActive).length,
  }), [rows]);

  const activeCount = stats.active;

  const resetForm = () => {
    setEditingId(null);
    setImage('');
    setAlt('');
    setTitle('');
    setTag('');
    setLinkUrl('');
    setFormError('');
  };

  const openCreate = () => { resetForm(); setShowForm(true); };

  const openEdit = (r: AppBanner) => {
    setEditingId(r.id);
    setImage(r.image);
    setAlt(r.alt);
    setTitle(r.title);
    setTag(r.tag);
    setLinkUrl(r.linkUrl);
    setFormError('');
    setShowForm(true);
  };

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      setImage(await uploadImage(file));
    } catch (e: any) {
      setFormError(e.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!image) { setFormError('Image is required'); return; }
    setSubmitting(true);
    setFormError('');
    try {
      const payload = { image, alt, title, tag, linkUrl };
      const res = editingId
        ? await fetch(`/api/dashboard/app-banners/${editingId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', ...authHeaders() },
            body: JSON.stringify(payload),
          })
        : await fetch('/api/dashboard/app-banners', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders() },
            body: JSON.stringify(payload),
          });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Save failed');

      if (editingId) {
        setRows((prev) => prev.map((r) => (r.id === editingId ? { ...r, ...data } : r)));
      } else {
        setRows((prev) => [...prev, data]);
      }
      setShowForm(false);
      resetForm();
    } catch (e: any) {
      setFormError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (r: AppBanner) => {
    setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, isActive: !r.isActive } : x)));
    await fetch(`/api/dashboard/app-banners/${r.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ isActive: !r.isActive }),
    });
  };

  const handleDelete = async (r: AppBanner) => {
    if (!confirm('Delete this carousel slide? This cannot be undone.')) return;
    const res = await fetch(`/api/dashboard/app-banners/${r.id}`, { method: 'DELETE', headers: authHeaders() });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.message || 'Failed to delete slide');
      return;
    }
    setRows((prev) => prev.filter((x) => x.id !== r.id));
  };

  const persistOrder = async (next: AppBanner[]) => {
    setReordering(true);
    try {
      await fetch('/api/dashboard/app-banners/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ order: next.map((r) => r.id) }),
      });
    } finally {
      setReordering(false);
    }
  };

  const handleDragStart = (index: number) => { dragIndex.current = index; };
  const handleDragOver = (index: number, e: React.DragEvent) => {
    e.preventDefault();
    if (dragIndex.current === null || dragIndex.current === index) return;
    setRows((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragIndex.current as number, 1);
      next.splice(index, 0, moved);
      dragIndex.current = index;
      return next;
    });
  };
  const handleDragEnd = () => {
    dragIndex.current = null;
    persistOrder(rows);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium text-[#004f9f]">App Carousel</h1>
          <p className="text-xs text-gray-400 mt-0.5">Mobile app home screen — drag rows to reorder</p>
        </div>
        <button onClick={openCreate}
          className="inline-flex items-center gap-2 bg-[#004f9f] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#003d7a] transition-colors">
          <Plus size={15} /> Add Slide
        </button>
      </div>

      <div className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 text-xs ${
        activeCount === 0
          ? 'bg-blue-50 border-blue-100 text-blue-800'
          : 'bg-gray-50 border-gray-100 text-gray-600'
      }`}>
        <Info size={14} className="mt-0.5 shrink-0" />
        {activeCount === 0 ? (
          <p>
            No active slides — the app carousel is currently showing the automatic
            <strong> most-watched videos</strong>, exactly as before. Add a slide here to
            put your own artwork in front of them.
          </p>
        ) : (
          <p>
            {activeCount} slide{activeCount === 1 ? '' : 's'} appear first in the app carousel,
            followed by the automatic most-watched videos. Hide or delete all slides to go back to
            videos only.
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Total Slides', value: stats.total, color: 'bg-blue-50 text-[#004f9f]' },
          { label: 'Active', value: stats.active, color: 'bg-green-50 text-green-700' },
        ].map((c) => (
          <div key={c.label} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${c.color}`}>
              <Smartphone size={18} />
            </div>
            <div>
              <p className={`text-2xl font-black ${c.color.split(' ')[1]}`}>{c.value}</p>
              <p className="text-xs text-gray-400">{c.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
        ) : loadError ? (
          <div className="py-16 flex flex-col items-center gap-2 text-red-500 text-sm">
            <AlertCircle size={18} /> {loadError}
          </div>
        ) : rows.length === 0 ? (
          <div className="py-20 text-center text-gray-400 text-sm">No slides yet. Add one to get started.</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {rows.map((r, i) => (
              <div
                key={r.id}
                draggable
                onDragStart={() => handleDragStart(i)}
                onDragOver={(e) => handleDragOver(i, e)}
                onDragEnd={handleDragEnd}
                className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50/50 transition-colors cursor-grab active:cursor-grabbing"
              >
                <GripVertical size={16} className="text-gray-300 shrink-0" />
                <span className="text-xs text-gray-400 w-5 shrink-0">{i + 1}</span>

                <div className="w-28 aspect-[16/9] rounded-lg overflow-hidden bg-gray-100 shrink-0 border border-gray-100">
                  <img src={r.image} alt={r.alt} className="w-full h-full object-cover" />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 truncate font-medium">
                    {r.title || <span className="text-gray-300 italic font-normal">No title</span>}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {r.tag && (
                      <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-gray-100 text-gray-500 rounded">{r.tag}</span>
                    )}
                    {r.linkUrl && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-gray-400 truncate">
                        <Link2 size={10} /> {r.linkUrl}
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  {r.isActive
                    ? <span className="px-2 py-0.5 text-[10px] font-bold bg-green-50 text-green-700 border border-green-200 rounded-full">Active</span>
                    : <span className="px-2 py-0.5 text-[10px] font-bold bg-red-50 text-red-600 border border-red-200 rounded-full">Hidden</span>}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => openEdit(r)} title="Edit"
                    className="p-1.5 rounded-lg bg-[#004f9f]/5 text-[#004f9f] hover:bg-[#004f9f]/10 transition-colors">
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => toggleActive(r)} title={r.isActive ? 'Hide from app' : 'Show in app'}
                    className={`p-1.5 rounded-lg transition-colors ${r.isActive ? 'bg-green-50 text-green-600 hover:bg-green-100' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}>
                    {r.isActive ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                  </button>
                  <button onClick={() => handleDelete(r)} title="Delete"
                    className="p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {reordering && (
        <p className="text-xs text-gray-400 flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> Saving order…</p>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-8 overflow-hidden">
            <div className="bg-[#004f9f] px-5 py-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">{editingId ? 'Edit Slide' : 'New Slide'}</p>
                <p className="text-white font-bold text-sm mt-0.5">{editingId ? 'Update App Slide' : 'Add App Carousel Slide'}</p>
              </div>
              <button onClick={() => setShowForm(false)} className="text-white/50 hover:text-white"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">
                  <Smartphone size={11} /> Slide Image
                </label>
                <div
                  onClick={() => fileRef.current?.click()}
                  className="relative w-full aspect-[16/9] rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 hover:bg-gray-100 hover:border-[#004f9f]/40 transition-colors cursor-pointer overflow-hidden flex items-center justify-center"
                >
                  {uploading ? (
                    <Loader2 className="w-5 h-5 animate-spin text-[#004f9f]" />
                  ) : image ? (
                    <img src={image} alt="Slide" className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center gap-1.5 text-gray-400 px-3 text-center">
                      <UploadCloud size={20} />
                      <span className="text-[11px] font-medium">Click to upload carousel artwork</span>
                    </div>
                  )}
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFile(file);
                      e.target.value = '';
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Title</label>
                  <input placeholder="Shown on the slide" value={title} onChange={(e) => setTitle(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#004f9f]" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Tag</label>
                  <input placeholder="e.g. Featured" value={tag} onChange={(e) => setTag(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#004f9f]" />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Link (optional)</label>
                <input placeholder="https://… — leave blank for a non-tappable slide" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#004f9f]" />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Alt Text (accessibility)</label>
                <textarea placeholder="Describe the slide for screen readers" value={alt} onChange={(e) => setAlt(e.target.value)}
                  rows={2}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#004f9f] resize-none" />
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
                <button onClick={handleSave} disabled={submitting || uploading}
                  className="flex-1 py-2.5 bg-[#004f9f] text-white text-sm font-bold rounded-lg hover:bg-[#003d7a] disabled:opacity-50 flex items-center justify-center gap-2">
                  {submitting ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />}
                  {editingId ? 'Save Changes' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
