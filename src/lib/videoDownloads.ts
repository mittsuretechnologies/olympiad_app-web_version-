import path from 'path';

// Shared by the SuperAdmin "Download Videos" routes.

/** e.g. riya_4wsn_Talent_Performance_2026-10-07_a1b2c3d4.mp4 */
export function downloadFileName(
  uploader: string | null | undefined,
  category: string | null | undefined,
  createdAt: Date,
  videoId: string,
  videoUrl: string,
): string {
  const clean = (s: string) => s.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
  let ext = 'mp4';
  try {
    const e = path.extname(new URL(videoUrl, 'http://x').pathname).replace('.', '').toLowerCase();
    if (/^[a-z0-9]{2,4}$/.test(e)) ext = e;
  } catch { /* keep mp4 */ }
  const parts = [
    clean(uploader || '') || 'video',
    clean(category || ''),
    createdAt.toISOString().slice(0, 10),
    videoId.slice(0, 8),
  ].filter(Boolean);
  return `${parts.join('_')}.${ext}`;
}

/** Purpose claim for the short-lived token in the /file route's URL. */
export const DOWNLOAD_TOKEN_PURPOSE = 'video-download';
