import type { MittTvSettings, RowSettings } from '@/lib/mittTvShared';

// Dashboard → MittTV: types, API calls and file uploads used by the page.

export interface TvVideo {
  id: string;
  title: string;
  description: string;
  tags: string;
  videoUrl: string;
  thumbnailUrl: string;
  posterUrl: string;
  durationSec: number;
  source: string;
  /** Extra data for the app's details page: meta.details = "label: value" lines, meta.notes = free-text paragraphs. */
  meta: { details?: { label: string; value: string }[]; notes?: string[] } & Record<string, unknown>;
  isActive: boolean;
  viewsCount: number;
  views7d: number;
  rowIds: string[];
  createdAt: string;
  previewVideoUrl: string | null;
  previewThumbnailUrl: string | null;
  previewPosterUrl: string | null;
}

export interface TvRow {
  id: string;
  title: string;
  subtitle: string;
  kind: string;
  style: string;
  settings: RowSettings;
  sortOrder: number;
  isVisible: boolean;
  /** Banner pinned videos / a hand-picked row's videos, in order. */
  videoIds: string[];
  /** What an automatic row (or the banner) shows right now. */
  autoIds: string[] | null;
}

export interface Snapshot {
  settings: MittTvSettings;
  rows: TvRow[];
  videos: TvVideo[];
}

export function authHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? sessionStorage.getItem('token') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** JSON call to a dashboard route; throws the server's message on failure. */
export async function api<T = any>(url: string, method = 'GET', body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...authHeaders() },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `Request failed (${res.status})`);
  return data as T;
}

// ── Uploads (same flow as Learning & Parenting) ─────────────────────────────

export const VIDEO_EXTS = ['mp4', 'mov', 'm4v', 'webm'];
const UPLOAD_STALL_MS = 45_000;

/** XMLHttpRequest wrapper — fetch() can't report upload progress. */
function xhr(
  method: string, url: string, body: XMLHttpRequestBodyInit,
  headers: Record<string, string>, onProgress: (pct: number) => void,
): Promise<{ status: number; text: string; stalled?: boolean }> {
  return new Promise((resolve) => {
    const req = new XMLHttpRequest();
    let stalled = false;
    let watchdog: ReturnType<typeof setTimeout> | undefined;
    const arm = () => {
      clearTimeout(watchdog);
      watchdog = setTimeout(() => { stalled = true; req.abort(); }, UPLOAD_STALL_MS);
    };
    const done = (status: number, text: string) => { clearTimeout(watchdog); resolve({ status, text, stalled }); };
    req.open(method, url);
    Object.entries(headers).forEach(([k, v]) => req.setRequestHeader(k, v));
    req.upload.onprogress = (e) => { arm(); if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); };
    req.upload.onload = () => clearTimeout(watchdog);
    req.onload = () => done(req.status, req.responseText);
    req.onerror = () => done(0, '');
    req.onabort = () => done(0, '');
    req.ontimeout = () => done(0, '');
    arm();
    req.send(body);
  });
}

/** Uploads a video (direct to S3 when possible, else through the server) and returns its URL. */
export async function uploadVideo(file: File, onProgress: (pct: number) => void): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (!VIDEO_EXTS.includes(ext)) throw new Error('Video must be MP4, MOV, M4V or WebM');

  const presign = await api<{ mode: string; uploadUrl?: string; contentType?: string; videoUrl?: string }>(
    '/api/dashboard/mitttv/upload-url', 'POST', { ext },
  );
  if (presign.mode === 's3' && presign.uploadUrl) {
    const put = await xhr('PUT', presign.uploadUrl, file, { 'Content-Type': presign.contentType || 'video/mp4' }, onProgress);
    if (put.status >= 200 && put.status < 300) return presign.videoUrl as string;
    console.warn(`Direct S3 upload failed (status ${put.status}${put.stalled ? ', stalled' : ''}); falling back to server upload.`);
    onProgress(0);
  }

  const res = await xhr(
    'POST', `/api/dashboard/mitttv/upload?ext=${encodeURIComponent(ext)}`, file,
    { ...authHeaders(), 'Content-Type': 'application/octet-stream' }, onProgress,
  );
  let data: any = {};
  try { data = JSON.parse(res.text); } catch { /* not JSON */ }
  if (res.status === 0) {
    throw new Error(res.stalled
      ? 'Upload stopped making progress — check your connection and try again'
      : 'Upload failed — check your connection and try again');
  }
  if (res.status < 200 || res.status >= 300) throw new Error(data.message || `Upload failed (${res.status})`);
  return data.videoUrl as string;
}

/** Uploads a thumbnail / poster picture and returns its URL. */
export async function uploadImage(file: File): Promise<string> {
  const fd = new FormData();
  fd.append('image', file);
  const res = await fetch('/api/dashboard/mitttv/image', { method: 'POST', headers: authHeaders(), body: fd });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Picture upload failed');
  return data.imageUrl as string;
}

function waitFor(el: HTMLElement, event: string, ms: number): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => { el.removeEventListener(event, onEvent); resolve(false); }, ms);
    function onEvent() { clearTimeout(timer); resolve(true); }
    el.addEventListener(event, onEvent, { once: true });
  });
}

async function waitForPaintedFrame(video: HTMLVideoElement): Promise<void> {
  const rvfc = (video as any).requestVideoFrameCallback?.bind(video);
  const presented = rvfc
    ? new Promise<void>((resolve) => { rvfc(() => resolve()); setTimeout(resolve, 2000); })
    : new Promise<void>((resolve) => setTimeout(resolve, 400));
  try { await video.play(); } catch { /* still draw whatever is decoded */ }
  await presented;
  video.pause();
}

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
 * Reads the video's length and grabs a thumbnail from it: a frame ~10% in,
 * then 25% / 50% / 75%, keeping the first that isn't nearly black. Resolves
 * with thumb null when the browser can't decode the video.
 */
export async function inspectVideo(file: File): Promise<{ thumb: File | null; durationSec: number }> {
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.src = url;
  let durationSec = 0;
  try {
    if (!(await waitFor(video, 'loadeddata', 15000)) || !video.videoWidth || !video.videoHeight) return { thumb: null, durationSec };
    const d = Number.isFinite(video.duration) ? video.duration : 0;
    durationSec = Math.round(d);
    const times = [Math.min(d * 0.1, 5), d * 0.25, d * 0.5, d * 0.75].filter((t, i, all) => t >= 0 && t < d && all.indexOf(t) === i);
    const scale = Math.min(1, 1280 / video.videoWidth);
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
      if (light > 25) break;
    }
    if (!best) return { thumb: null, durationSec };
    const blob = await new Promise<Blob | null>((resolve) => best!.canvas.toBlob(resolve, 'image/jpeg', 0.85));
    return { thumb: blob ? new File([blob], 'thumbnail.jpg', { type: 'image/jpeg' }) : null, durationSec };
  } catch {
    return { thumb: null, durationSec };
  } finally {
    video.pause();
    video.removeAttribute('src');
    video.load();
    URL.revokeObjectURL(url);
  }
}
