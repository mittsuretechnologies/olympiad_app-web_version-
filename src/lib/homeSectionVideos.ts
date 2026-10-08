import path from 'path';
import os from 'os';
import { randomUUID } from 'crypto';
import { readFile, stat, unlink, writeFile } from 'fs/promises';
import { deleteFromS3, downloadFromS3, s3Enabled, s3KeyFromUrl, uploadBufferToS3 } from '@/lib/s3';
import { extractThumbnail } from '@/lib/videoProbe';

// SuperAdmin-managed "Learning" and "Parenting" rows on the app home screen.
// See the HomeSectionVideo model for why these live outside the Video table.

export const HOME_SECTIONS = ['LEARNING', 'PARENTING'] as const;
export type HomeSection = (typeof HOME_SECTIONS)[number];

export function isHomeSection(value: unknown): value is HomeSection {
  return typeof value === 'string' && (HOME_SECTIONS as readonly string[]).includes(value);
}

export const HOME_VIDEO_EXTS = ['mp4', 'mov', 'm4v', 'webm'];

export function safeVideoExt(ext: unknown): string | null {
  const e = typeof ext === 'string' ? ext.toLowerCase().replace(/^\./, '') : '';
  return HOME_VIDEO_EXTS.includes(e) ? e : null;
}

/**
 * Removes a stored media file once nothing points at it any more (row deleted,
 * or its video/thumbnail replaced). Best-effort: a failed cleanup leaves an
 * orphaned file behind but must never fail the admin's request.
 *
 * Only touches files this feature (or the banner image upload it reuses for
 * thumbnails) wrote — S3 objects in our bucket, or local files under
 * public/uploads/{home-videos,banners}. Anything else is left alone.
 */
export async function deleteHomeVideoMedia(url: string | null | undefined): Promise<void> {
  if (!url) return;
  try {
    if (s3Enabled()) {
      const key = s3KeyFromUrl(url);
      if (key && (key.startsWith('uploads/home-videos/') || key.startsWith('uploads/banners/'))) {
        await deleteFromS3(key);
      }
      return;
    }
    const match = url.match(/\/uploads\/(home-videos|banners)\/([^/?#]+)$/);
    if (match) {
      await unlink(path.join(process.cwd(), 'public', 'uploads', match[1], match[2]));
    }
  } catch (err) {
    console.error(`Could not delete home video media ${url}:`, err);
  }
}

/**
 * Server-side thumbnail, used when the dashboard couldn't capture one in the
 * browser. The usual reason is a damaged audio track: browsers then refuse to
 * load the whole file, but ffmpeg can still read the picture (see
 * extractThumbnail). Returns the stored thumbnail URL, or '' on any failure —
 * a missing thumbnail must never stop the video being saved.
 *
 * Only handles videos this feature stored (uploads/home-videos in S3, or
 * public/uploads/home-videos locally). The thumbnail is written next to the
 * video as <name>_thumb.jpg, so deleteHomeVideoMedia cleans it up too.
 */
export async function generateServerThumbnail(videoUrl: string): Promise<string> {
  const tmpDir = os.tmpdir();
  const tmpVideo = path.join(tmpDir, `hv-src-${randomUUID()}`);
  const tmpThumb = path.join(tmpDir, `hv-thumb-${randomUUID()}.jpg`);
  let localVideoPath: string | null = null;

  try {
    let baseName: string;
    if (s3Enabled()) {
      const key = s3KeyFromUrl(videoUrl);
      if (!key || !key.startsWith('uploads/home-videos/')) return '';
      await downloadFromS3(key, tmpVideo);
      localVideoPath = tmpVideo;
      baseName = path.basename(key).replace(/\.[^.]+$/, '');
    } else {
      const match = videoUrl.match(/\/uploads\/home-videos\/([^/?#]+)$/);
      if (!match) return '';
      localVideoPath = path.join(process.cwd(), 'public', 'uploads', 'home-videos', match[1]);
      baseName = match[1].replace(/\.[^.]+$/, '');
    }

    await extractThumbnail(localVideoPath, tmpThumb);
    if ((await stat(tmpThumb)).size === 0) return '';
    const jpg = await readFile(tmpThumb);
    const thumbName = `${baseName}_thumb.jpg`;

    if (s3Enabled()) {
      return await uploadBufferToS3(jpg, `uploads/home-videos/${thumbName}`, 'image/jpeg');
    }
    await writeFile(path.join(process.cwd(), 'public', 'uploads', 'home-videos', thumbName), jpg);
    const serverUrl = process.env.SERVER_URL || 'http://localhost:3000';
    return `${serverUrl}/uploads/home-videos/${thumbName}`;
  } catch (err) {
    console.error(`Server thumbnail for ${videoUrl} failed:`, err);
    return '';
  } finally {
    await unlink(tmpThumb).catch(() => {});
    if (localVideoPath === tmpVideo) await unlink(tmpVideo).catch(() => {});
  }
}
