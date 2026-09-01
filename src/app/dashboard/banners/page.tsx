'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Loader2, ImageIcon, Plus, X, Trash2, AlertCircle, ToggleLeft, ToggleRight,
  UploadCloud, GripVertical, Monitor, Smartphone, Pencil,
} from 'lucide-react';

interface Banner {
  id: string;
  desktopImage: string;
  mobileImage: string | null;
  alt: string;
  order: number;
  isActive: boolean;
  createdAt: string;
}

function authHeaders(): Record<string, string> {
  const token = sessionStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

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

function ImageDropSlot({
  label, icon, hint, value, onChange, uploading,
}: {
  label: string;
  icon: React.ReactNode;
  hint: string;
  value: string;
  onChange: (file: File) => void;
  uploading: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div>
      <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">
        {icon} {label}
      </label>
      <div
        onClick={() => inputRef.current?.click()}
        className="relative w-full aspect-[16/9] rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 hover:bg-gray-100 hover:border-[#004f9f]/40 transition-colors cursor-pointer overflow-hidden flex items-center justify-center"
      >
        {uploading ? (
          <Loader2 className="w-5 h-5 animate-spin text-[#004f9f]" />
        ) : value ? (
          <img src={value} alt={label} className="w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-1.5 text-gray-400 px-3 text-center">
            <UploadCloud size={20} />
            <span className="text-[11px] font-medium">{hint}</span>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onChange(file);
            e.target.value = '';
          }}
        />
      </div>
    </div>
  );
}

export default function ManageBannersPage() {
  const [rows, setRows] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [desktopImage, setDesktopImage] = useState('');
  const [mobileImage, setMobileImage] = useState('');
  const [alt, setAlt] = useState('');
  const [uploadingDesktop, setUploadingDesktop] = useState(false);
  const [uploadingMobile, setUploadingMobile] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const dragIndex = useRef<number | null>(null);
  const [reordering, setReordering] = useState(false);

  const load = () => {
    setLoading(true);
    setLoadError('');
    fetch('/api/dashboard/banners', { headers: authHeaders() })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.message || 'Failed to load banners');
        setRows(Array.isArray(data) ? data : []);
      })
      .catch((e) => setLoadError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const stats = useMemo(() => ({
    total: rows.length,
    active: rows.filter((r) => r.isActive).length,
    missingMobile: rows.filter((r) => !r.mobileImage).length,
  }), [rows]);

  const resetForm = () => {
    setEditingId(null);
    setDesktopImage('');
    setMobileImage('');
    setAlt('');
    setFormError('');
  };

  const openCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (r: Banner) => {
    setEditingId(r.id);
    setDesktopImage(r.desktopImage);
    setMobileImage(r.mobileImage || '');
    setAlt(r.alt);
    setFormError('');
    setShowForm(true);
  };

  const handleDesktopFile = async (file: File) => {
    setUploadingDesktop(true);
    try {
      setDesktopImage(await uploadImage(file));
    } catch (e: any) {
      setFormError(e.message);
    } finally {
      setUploadingDesktop(false);
    }
  };

  const handleMobileFile = async (file: File) => {
    setUploadingMobile(true);
    try {
      setMobileImage(await uploadImage(file));
    } catch (e: any) {
      setFormError(e.message);
    } finally {
      setUploadingMobile(false);
    }
  };

  const handleSave = async () => {
    if (!desktopImage) { setFormError('Desktop image is required'); return; }
    setSubmitting(true);
    setFormError('');
    try {
      const payload = { desktopImage, mobileImage: mobileImage || null, alt };
      const res = editingId
        ? await fetch(`/api/dashboard/banners/${editingId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', ...authHeaders() },
            body: JSON.stringify(payload),
          })
        : await fetch('/api/dashboard/banners', {
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

  const toggleActive = async (r: Banner) => {
    setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, isActive: !r.isActive } : x)));
    await fetch(`/api/dashboard/banners/${r.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ isActive: !r.isActive }),
    });
  };

  const handleDelete = async (r: Banner) => {
    if (!confirm(`Delete this banner slide? This cannot be undone.`)) return;
    const res = await fetch(`/api/dashboard/banners/${r.id}`, { method: 'DELETE', headers: authHeaders() });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.message || 'Failed to delete banner');
      return;
    }
    setRows((prev) => prev.filter((x) => x.id !== r.id));
  };

  const persistOrder = async (next: Banner[]) => {
    setReordering(true);
    try {
      await fetch('/api/dashboard/banners/reorder', {
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
          <h1 className="text-2xl font-medium text-[#004f9f]">Manage Banners</h1>
          <p className="text-xs text-gray-400 mt-0.5">Landing page hero carousel — drag rows to reorder</p>
        </div>
        <button onClick={openCreate}
          className="inline-flex items-center gap-2 bg-[#004f9f] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#003d7a] transition-colors">
          <Plus size={15} /> Add Banner
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Slides', value: stats.total, color: 'bg-blue-50 text-[#004f9f]' },
          { label: 'Active', value: stats.active, color: 'bg-green-50 text-green-700' },
          { label: 'Missing Mobile Crop', value: stats.missingMobile, color: 'bg-orange-50 text-orange-600' },
        ].map((c) => (
          <div key={c.label} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${c.color}`}>
              <ImageIcon size={18} />
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
          <div className="py-20 text-center text-gray-400 text-sm">No banners yet. Add one to get started.</div>
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
                  <img src={r.desktopImage} alt={r.alt} className="w-full h-full object-cover" />
                </div>
                <div className="w-16 aspect-[16/9] rounded-lg overflow-hidden bg-gray-100 shrink-0 border border-gray-100 relative">
                  {r.mobileImage ? (
                    <img src={r.mobileImage} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300">
                      <Smartphone size={14} />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-600 truncate">{r.alt || <span className="text-gray-300 italic">No alt text</span>}</p>
                  {!r.mobileImage && (
                    <p className="text-[10px] text-orange-500 font-semibold mt-0.5">No mobile crop — desktop image used on all sizes</p>
                  )}
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
                  <button onClick={() => toggleActive(r)} title={r.isActive ? 'Hide from site' : 'Show on site'}
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
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">{editingId ? 'Edit Banner' : 'New Banner'}</p>
                <p className="text-white font-bold text-sm mt-0.5">{editingId ? 'Update Slide' : 'Add Carousel Slide'}</p>
              </div>
              <button onClick={() => setShowForm(false)} className="text-white/50 hover:text-white"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <ImageDropSlot
                  label="Desktop Image"
                  icon={<Monitor size={11} />}
                  hint="Click to upload (wide banner)"
                  value={desktopImage}
                  onChange={handleDesktopFile}
                  uploading={uploadingDesktop}
                />
                <ImageDropSlot
                  label="Mobile Image"
                  icon={<Smartphone size={11} />}
                  hint="Click to upload (taller crop)"
                  value={mobileImage}
                  onChange={handleMobileFile}
                  uploading={uploadingMobile}
                />
              </div>
              <p className="text-[11px] text-gray-400 -mt-2">
                Mobile image is optional — if left blank, the desktop image is used on phones too (may be cropped tighter).
              </p>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Alt Text (accessibility)</label>
                <textarea placeholder="Describe the banner for screen readers" value={alt} onChange={(e) => setAlt(e.target.value)}
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
                <button onClick={handleSave} disabled={submitting || uploadingDesktop || uploadingMobile}
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
