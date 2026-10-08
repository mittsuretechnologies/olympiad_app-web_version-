'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Loader2, Plus, X, Trash2, AlertCircle, ToggleLeft, ToggleRight, UploadCloud,
  GripVertical, Pencil, Info, GraduationCap, HeartHandshake, Film, ImageIcon, Eye,
  GalleryHorizontal,
} from 'lucide-react';

// SuperAdmin page for the app home screen's "Learning" and "Parenting" rows.
// Videos uploaded here go live immediately (no moderation) and appear only in
// those two rows — see the HomeSectionVideo model.

type Section = 'LEARNING' | 'PARENTING';

interface HomeVideo {
  id: string;
  section: Section;
  title: string;
  description: string;
  videoUrl: string;
  thumbnailUrl: string;
  order: number;
  isActive: boolean;
  inCarousel: boolean;
  viewsCount: number;
  createdAt: string;
  previewVideoUrl: string | null;
  previewThumbnailUrl: string | null;
}

const SECTIONS: { key: Section; label: string; icon: typeof GraduationCap }[] = [
  { key: 'LEARNING', label: 'Learning', icon: GraduationCap },
  { key: 'PARENTING', label: 'Parenting', icon: HeartHandshake },
];

const VIDEO_EXTS = ['mp4', 'mov', 'm4v', 'webm'];

function authHeaders(): Record<string, string> {
  const token = sessionStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** XMLHttpRequest wrapper — fetch() can't report upload progress. */
function xhr(
  method: string, url: string, body: XMLHttpRequestBodyInit,
  headers: Record<string, string>, onProgress: (pct: number) => void,
): Promise<{ status: number; text: string }> {
  return new Promise((resolve) => {
    const req = new XMLHttpRequest();
    req.open(method, url);
    Object.entries(headers).forEach(([k, v]) => req.setRequestHeader(k, v));
    req.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); };
    req.onload = () => resolve({ status: req.status, text: req.responseText });
    // status 0 = the request never got a response (network error, or a CORS
    // refusal on the direct-to-S3 PUT) — the caller decides whether to fall back.
    req.onerror = () => resolve({ status: 0, text: '' });
    req.send(body);
  });
}

/**
 * Uploads a video and returns its stored URL. Tries direct-to-S3 first (the
 * file never touches our server); if S3 isn't configured, or the browser's PUT
 * is refused (most often: the bucket has no CORS rule for this origin), it
 * falls back to sending the file through the server.
 */
async function uploadVideo(file: File, onProgress: (pct: number) => void): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (!VIDEO_EXTS.includes(ext)) throw new Error('Video must be MP4, MOV, M4V or WebM');

  const presignRes = await fetch('/api/dashboard/home-videos/upload-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ ext }),
  });
  const presign = await presignRes.json();
  if (!presignRes.ok) throw new Error(presign.message || 'Could not start the upload');

  if (presign.mode === 's3') {
    const put = await xhr('PUT', presign.uploadUrl, file, { 'Content-Type': presign.contentType }, onProgress);
    if (put.status >= 200 && put.status < 300) return presign.videoUrl as string;
    console.warn(`Direct S3 upload failed (status ${put.status}); falling back to server upload.`);
    onProgress(0);
  }

  // The raw file as the request body (not multipart), so the server can
  // stream it to disk whatever its size.
  const res = await xhr(
    'POST', `/api/dashboard/home-videos/upload?ext=${encodeURIComponent(ext)}`, file,
    { ...authHeaders(), 'Content-Type': 'application/octet-stream' }, onProgress,
  );
  let data: any = {};
  try { data = JSON.parse(res.text); } catch { /* non-JSON error page */ }
  if (res.status === 0) throw new Error('Upload failed — check your connection and try again');
  if (res.status === 413) throw new Error(data.message || 'Video is too large for the server');
  if (res.status < 200 || res.status >= 300) throw new Error(data.message || `Upload failed (${res.status})`);
  return data.videoUrl as string;
}

/** Resolves when `event` fires on `el`, or false after `ms` (never rejects). */
function waitFor(el: HTMLElement, event: string, ms: number): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => { el.removeEventListener(event, onEvent); resolve(false); }, ms);
    function onEvent() { clearTimeout(timer); resolve(true); }
    el.addEventListener(event, onEvent, { once: true });
  });
}

/**
 * Waits until the video has actually painted a frame at its current position.
 * Drawing straight after a seek is not enough: browsers often haven't decoded
 * the frame yet, and the canvas comes out solid black (which is exactly what
 * the first version of this produced). A brief muted play forces a real frame
 * to be presented; requestVideoFrameCallback says when, where supported.
 */
async function waitForPaintedFrame(video: HTMLVideoElement): Promise<void> {
  const rvfc = (video as any).requestVideoFrameCallback?.bind(video);
  const presented = rvfc
    ? new Promise<void>((resolve) => { rvfc(() => resolve()); setTimeout(resolve, 2000); })
    : new Promise<void>((resolve) => setTimeout(resolve, 400));
  try { await video.play(); } catch { /* still try to draw whatever is decoded */ }
  await presented;
  video.pause();
}

/** Average brightness 0–255 of a frame, sampled from a 24×24 downscale. */
function brightness(source: HTMLCanvasElement): number {
  const small = document.createElement('canvas');
  small.width = 24; small.height = 24;
  const ctx = small.getContext('2d')!;
  ctx.drawImage(source, 0, 0, 24, 24);
  const { data } = ctx.getImageData(0, 0, 24, 24);
  let sum = 0;
  for (let i = 0; i < data.length; i += 4) sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  return sum / (data.length / 4);
}

/**
 * Makes the thumbnail automatically from the picked video: tries a frame ~1s
 * in, then 25% / 50% / 75% of the way through, and keeps the first one that
 * isn't nearly black (videos often open on a black or fade-in frame). Falls
 * back to the brightest frame it saw. Runs on the browser's local copy of the
 * file, alongside the upload. Resolves null when the browser can't decode the
 * video at all (e.g. some HEVC .mov files) — the video still publishes, just
 * without a thumbnail.
 */
async function captureThumbnail(file: File): Promise<File | null> {
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.src = url;

  try {
    if (!(await waitFor(video, 'loadeddata', 15000)) || !video.videoWidth || !video.videoHeight) return null;

    const d = Number.isFinite(video.duration) ? video.duration : 0;
    const times = [Math.min(1, d / 4), d * 0.25, d * 0.5, d * 0.75]
      .filter((t, i, all) => t >= 0 && t < d && all.indexOf(t) === i);

    // Cap the stored size — thumbnails are shown small in the app.
    const scale = Math.min(1, 720 / video.videoWidth);
    let best: { canvas: HTMLCanvasElement; light: number } | null = null;

    for (const t of times) {
      video.currentTime = t;
      await waitFor(video, 'seeked', 5000);
      await waitForPaintedFrame(video);

      const canvas = document.createElement('canvas');
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      canvas.getContext('2d')!.drawImage(video, 0, 0, canvas.width, canvas.height);

      const light = brightness(canvas);
      if (!best || light > best.light) best = { canvas, light };
      if (light > 25) break; // a properly lit frame — good enough
    }

    if (!best) return null;
    const blob = await new Promise<Blob | null>((resolve) => best!.canvas.toBlob(resolve, 'image/jpeg', 0.85));
    return blob ? new File([blob], 'thumbnail.jpg', { type: 'image/jpeg' }) : null;
  } catch {
    return null;
  } finally {
    video.pause();
    video.removeAttribute('src');
    video.load();
    URL.revokeObjectURL(url);
  }
}

// Thumbnails reuse the generic banner image upload (returns a hosted URL).
async function uploadThumbnail(file: File): Promise<string> {
  const fd = new FormData();
  fd.append('image', file);
  const res = await fetch('/api/dashboard/banners/upload', { method: 'POST', headers: authHeaders(), body: fd });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Thumbnail upload failed');
  return data.imageUrl as string;
}

export default function HomeVideosPage() {
  const [rows, setRows] = useState<HomeVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [tab, setTab] = useState<Section>('LEARNING');

  // Form
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [section, setSection] = useState<Section>('LEARNING');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  // Local previews: the stored URLs point at a private bucket, so a just-picked
  // file is previewed from the browser's copy instead.
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [thumbPreview, setThumbPreview] = useState<string | null>(null);
  const [videoProgress, setVideoProgress] = useState<number | null>(null);
  const [thumbUploading, setThumbUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const videoRef = useRef<HTMLInputElement>(null);
  const dragIndex = useRef<number | null>(null);
  const [reordering, setReordering] = useState(false);

  const load = () => {
    setLoading(true);
    setLoadError('');
    fetch('/api/dashboard/home-videos', { headers: authHeaders() })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.message || 'Failed to load videos');
        setRows(Array.isArray(data) ? data : []);
      })
      .catch((e) => setLoadError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const visible = useMemo(
    () => rows.filter((r) => r.section === tab).sort((a, b) => a.order - b.order),
    [rows, tab],
  );
  const countFor = (s: Section) => ({
    total: rows.filter((r) => r.section === s).length,
    active: rows.filter((r) => r.section === s && r.isActive).length,
  });

  const resetForm = () => {
    setEditingId(null);
    setSection(tab);
    setTitle('');
    setDescription('');
    setVideoUrl('');
    setThumbnailUrl('');
    setVideoPreview(null);
    setThumbPreview(null);
    setVideoProgress(null);
    setFormError('');
  };

  const openCreate = () => { resetForm(); setShowForm(true); };

  const openEdit = (r: HomeVideo) => {
    setEditingId(r.id);
    setSection(r.section);
    setTitle(r.title);
    setDescription(r.description);
    setVideoUrl(r.videoUrl);
    setThumbnailUrl(r.thumbnailUrl);
    setVideoPreview(r.previewVideoUrl);
    setThumbPreview(r.previewThumbnailUrl);
    setVideoProgress(null);
    setFormError('');
    setShowForm(true);
  };

  // Uploads the video and, alongside it, a thumbnail captured from one of its
  // frames. A failed thumbnail never blocks the video — it's saved without one.
  const handleVideoFile = async (file: File) => {
    setFormError('');
    setVideoPreview(URL.createObjectURL(file));
    setVideoProgress(0);
    setThumbnailUrl('');
    setThumbPreview(null);
    setThumbUploading(true);

    const thumbJob = captureThumbnail(file)
      .then(async (thumb) => {
        if (!thumb) return;
        setThumbPreview(URL.createObjectURL(thumb));
        setThumbnailUrl(await uploadThumbnail(thumb));
      })
      .catch(() => { setThumbnailUrl(''); })
      .finally(() => setThumbUploading(false));

    try {
      setVideoUrl(await uploadVideo(file, setVideoProgress));
    } catch (e: any) {
      setFormError(e.message);
      setVideoPreview(null);
      setVideoUrl('');
    } finally {
      setVideoProgress(null);
    }
    await thumbJob;
  };

  const uploading = videoProgress !== null || thumbUploading;

  const handleSave = async () => {
    if (!title.trim()) { setFormError('Title is required'); return; }
    if (!videoUrl) { setFormError('Upload a video'); return; }
    setSubmitting(true);
    setFormError('');
    try {
      const payload = { section, title, description, videoUrl, thumbnailUrl };
      const res = await fetch(editingId ? `/api/dashboard/home-videos/${editingId}` : '/api/dashboard/home-videos', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Save failed');
      setRows((prev) => (editingId ? prev.map((r) => (r.id === editingId ? data : r)) : [...prev, data]));
      setTab(data.section);
      setShowForm(false);
      resetForm();
    } catch (e: any) {
      setFormError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (r: HomeVideo) => {
    setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, isActive: !r.isActive } : x)));
    const res = await fetch(`/api/dashboard/home-videos/${r.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ isActive: !r.isActive }),
    });
    if (!res.ok) {
      setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, isActive: r.isActive } : x)));
      alert('Could not update the video');
    }
  };

  // Adds / removes the video from the app's home carousel (shown there only
  // while the video itself is Active).
  const toggleCarousel = async (r: HomeVideo) => {
    setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, inCarousel: !r.inCarousel } : x)));
    const res = await fetch(`/api/dashboard/home-videos/${r.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ inCarousel: !r.inCarousel }),
    });
    if (!res.ok) {
      setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, inCarousel: r.inCarousel } : x)));
      alert('Could not update the video');
    }
  };

  const handleDelete = async (r: HomeVideo) => {
    if (!confirm(`Delete "${r.title}"? The video file is deleted too. This cannot be undone.`)) return;
    const res = await fetch(`/api/dashboard/home-videos/${r.id}`, { method: 'DELETE', headers: authHeaders() });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.message || 'Failed to delete video');
      return;
    }
    setRows((prev) => prev.filter((x) => x.id !== r.id));
  };

  // Drag-to-reorder within the current tab's section.
  const handleDragStart = (index: number) => { dragIndex.current = index; };
  const handleDragOver = (index: number, e: React.DragEvent) => {
    e.preventDefault();
    const from = dragIndex.current;
    if (from === null || from === index) return;
    const next = [...visible];
    const [moved] = next.splice(from, 1);
    next.splice(index, 0, moved);
    dragIndex.current = index;
    const orderById = new Map(next.map((r, i) => [r.id, i]));
    setRows((prev) => prev.map((r) => (orderById.has(r.id) ? { ...r, order: orderById.get(r.id)! } : r)));
  };
  const handleDragEnd = async () => {
    dragIndex.current = null;
    setReordering(true);
    try {
      await fetch('/api/dashboard/home-videos/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ section: tab, order: visible.map((r) => r.id) }),
      });
    } finally {
      setReordering(false);
    }
  };

  const TabIcon = SECTIONS.find((s) => s.key === tab)!.icon;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium text-[#004f9f]">Learning &amp; Parenting</h1>
          <p className="text-xs text-gray-400 mt-0.5">Videos for the mobile app home screen — drag rows to reorder</p>
        </div>
        <button onClick={openCreate}
          className="inline-flex items-center gap-2 bg-[#004f9f] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#003d7a] transition-colors">
          <Plus size={15} /> Add Video
        </button>
      </div>

      <div className="flex items-start gap-2.5 rounded-xl border px-4 py-3 text-xs bg-gray-50 border-gray-100 text-gray-600">
        <Info size={14} className="mt-0.5 shrink-0" />
        <p>
          Active videos appear straight away in the app&apos;s <strong>Learning</strong> and <strong>Parenting</strong> rows
          (below MittFest), visible to every user — they skip moderation. A row with no active videos is hidden in
          the app. Shown only in app versions that include these rows. Use the carousel button
          (<GalleryHorizontal size={11} className="inline -mt-0.5" />) to also show a video in the home carousel.
        </p>
      </div>

      {/* Section tabs */}
      <div className="flex gap-2">
        {SECTIONS.map(({ key, label, icon: Icon }) => {
          const c = countFor(key);
          return (
            <button key={key} onClick={() => setTab(key)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                tab === key ? 'bg-[#004f9f] text-white border-[#004f9f]' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}>
              <Icon size={15} /> {label}
              <span className={`text-[11px] px-1.5 rounded-full ${tab === key ? 'bg-white/20' : 'bg-gray-100'}`}>{c.active}/{c.total}</span>
            </button>
          );
        })}
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
        ) : loadError ? (
          <div className="py-16 flex flex-col items-center gap-2 text-red-500 text-sm"><AlertCircle size={18} /> {loadError}</div>
        ) : visible.length === 0 ? (
          <div className="py-20 flex flex-col items-center gap-2 text-gray-400 text-sm">
            <TabIcon size={22} />
            No {tab === 'LEARNING' ? 'Learning' : 'Parenting'} videos yet. The row is hidden in the app until you add one.
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {visible.map((r, i) => (
              <div key={r.id} draggable
                onDragStart={() => handleDragStart(i)}
                onDragOver={(e) => handleDragOver(i, e)}
                onDragEnd={handleDragEnd}
                className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50/50 transition-colors cursor-grab active:cursor-grabbing">
                <GripVertical size={16} className="text-gray-300 shrink-0" />
                <span className="text-xs text-gray-400 w-5 shrink-0">{i + 1}</span>
                <div className="w-14 aspect-[9/16] rounded-lg overflow-hidden bg-gray-100 shrink-0 border border-gray-100">
                  {r.previewThumbnailUrl
                    ? <img src={r.previewThumbnailUrl} alt="" className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-gray-300"><Film size={16} /></div>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 truncate font-medium">{r.title}</p>
                  {r.description && <p className="text-xs text-gray-400 truncate mt-0.5">{r.description}</p>}
                  <p className="text-[11px] text-gray-400 mt-1 inline-flex items-center gap-1"><Eye size={11} /> {r.viewsCount} views</p>
                </div>
                <div>
                  {r.isActive
                    ? <span className="px-2 py-0.5 text-[10px] font-bold bg-green-50 text-green-700 border border-green-200 rounded-full">Active</span>
                    : <span className="px-2 py-0.5 text-[10px] font-bold bg-red-50 text-red-600 border border-red-200 rounded-full">Hidden</span>}
                  {r.inCarousel && (
                    <span className="ml-1.5 px-2 py-0.5 text-[10px] font-bold bg-[#004f9f]/5 text-[#004f9f] border border-[#004f9f]/20 rounded-full">In carousel</span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => openEdit(r)} title="Edit"
                    className="p-1.5 rounded-lg bg-[#004f9f]/5 text-[#004f9f] hover:bg-[#004f9f]/10 transition-colors"><Pencil size={13} /></button>
                  <button onClick={() => toggleCarousel(r)} title={r.inCarousel ? 'Remove from home carousel' : 'Show in home carousel'}
                    className={`p-1.5 rounded-lg transition-colors ${r.inCarousel ? 'bg-[#004f9f] text-white hover:bg-[#003d7a]' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}>
                    <GalleryHorizontal size={13} />
                  </button>
                  <button onClick={() => toggleActive(r)} title={r.isActive ? 'Hide from app' : 'Show in app'}
                    className={`p-1.5 rounded-lg transition-colors ${r.isActive ? 'bg-green-50 text-green-600 hover:bg-green-100' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}>
                    {r.isActive ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                  </button>
                  <button onClick={() => handleDelete(r)} title="Delete"
                    className="p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors"><Trash2 size={13} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {reordering && <p className="text-xs text-gray-400 flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> Saving order…</p>}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-8 overflow-hidden">
            <div className="bg-[#004f9f] px-5 py-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">{editingId ? 'Edit Video' : 'New Video'}</p>
                <p className="text-white font-bold text-sm mt-0.5">{editingId ? 'Update Home Screen Video' : 'Add Learning / Parenting Video'}</p>
              </div>
              <button onClick={() => !uploading && setShowForm(false)} disabled={uploading}
                className="text-white/50 hover:text-white disabled:opacity-40"><X size={18} /></button>
            </div>

            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Section</label>
                <div className="grid grid-cols-2 gap-2">
                  {SECTIONS.map(({ key, label, icon: Icon }) => (
                    <button key={key} type="button" onClick={() => setSection(key)}
                      className={`inline-flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold border transition-colors ${
                        section === key ? 'bg-[#004f9f]/10 border-[#004f9f] text-[#004f9f]' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                      }`}>
                      <Icon size={15} /> {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Video — the thumbnail is captured from it automatically */}
              <div className="max-w-[260px] mx-auto">
                <div>
                  <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5"><Film size={11} /> Video *</label>
                  <div onClick={() => !uploading && videoRef.current?.click()}
                    className="relative w-full aspect-[9/16] rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 hover:bg-gray-100 hover:border-[#004f9f]/40 transition-colors cursor-pointer overflow-hidden flex items-center justify-center">
                    {videoPreview
                      ? <video src={videoPreview} className="w-full h-full object-cover" muted controls={videoProgress === null} />
                      : <div className="flex flex-col items-center gap-1.5 text-gray-400 px-3 text-center"><UploadCloud size={20} /><span className="text-[11px] font-medium">MP4, MOV, M4V or WebM</span></div>}
                    {videoProgress !== null && (
                      <div className="absolute inset-x-0 bottom-0 bg-black/60 px-3 py-2">
                        <div className="h-1.5 rounded-full bg-white/30 overflow-hidden"><div className="h-full bg-white transition-all" style={{ width: `${videoProgress}%` }} /></div>
                        <p className="text-[10px] text-white mt-1 text-center">Uploading… {videoProgress}%</p>
                      </div>
                    )}
                    <input ref={videoRef} type="file" accept="video/mp4,video/quicktime,video/x-m4v,video/webm" className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleVideoFile(f); e.target.value = ''; }} />
                  </div>
                  {videoUrl && videoProgress === null && <p className="text-[10px] text-green-600 mt-1">✓ Video uploaded — click to replace</p>}
                  {videoPreview && (
                    <p className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1">
                      {thumbUploading
                        ? <><Loader2 size={10} className="animate-spin" /> Creating thumbnail…</>
                        : thumbPreview || thumbnailUrl
                          ? <><ImageIcon size={10} /> Thumbnail created from the video</>
                          : <><ImageIcon size={10} /> No thumbnail — the app shows a placeholder</>}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Title *</label>
                <input placeholder="Shown under the video in the app" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#004f9f]" />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Description (optional)</label>
                <textarea placeholder="Shown in the player" value={description} maxLength={1000} rows={3} onChange={(e) => setDescription(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#004f9f] resize-none" />
              </div>

              {formError && (
                <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2"><AlertCircle size={13} /> {formError}</div>
              )}

              <div className="flex gap-2 pt-1">
                <button onClick={() => setShowForm(false)} disabled={uploading}
                  className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-sm font-semibold rounded-lg hover:bg-gray-50 disabled:opacity-50">Cancel</button>
                <button onClick={handleSave} disabled={submitting || uploading}
                  className="flex-1 py-2.5 bg-[#004f9f] text-white text-sm font-bold rounded-lg hover:bg-[#003d7a] disabled:opacity-50 flex items-center justify-center gap-2">
                  {submitting ? <Loader2 size={14} className="animate-spin" /> : <Film size={14} />}
                  {editingId ? 'Save Changes' : 'Publish'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
