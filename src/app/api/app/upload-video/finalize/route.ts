import { NextResponse } from 'next/server';
import { verify } from 'jsonwebtoken';
import { unlink } from 'fs/promises';
import path from 'path';
import os from 'os';
import { randomUUID } from 'crypto';
import { spawn } from 'child_process';
import { s3PublicUrl, s3Enabled, uploadFileToS3, uploadLargeFileToS3, deleteFromS3, downloadFromS3 } from '@/lib/s3';
import { localUploadsAllowed, localPathForKey, localMediaUrl, isSafeKey } from '@/lib/localUploads';
import { getJwtSecret } from '@/lib/jwt-secret';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ffmpegPath: string = require('ffmpeg-static');

const JWT_SECRET = getJwtSecret();
const MAX_DURATION_SECONDS = 120;

export const dynamic     = 'force-dynamic';
// Cropping re-encodes the video, which takes longer than the old checks alone.
export const maxDuration  = 300;

function getAppUserFromToken(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  try {
    const decoded = verify(token, JWT_SECRET) as any;
    if (decoded.role !== 'APP_USER') return null;
    return decoded;
  } catch {
    return null;
  }
}

// ffmpeg-static's Linux binary segfaults on an https:// -i input (verified against
// this bucket), so both passes run against a local copy downloaded from S3 first.
function getVideoDurationSeconds(videoPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, ['-i', videoPath]);
    let stderr = '';
    proc.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    proc.on('error', reject);
    proc.on('close', () => {
      const match = stderr.match(/Duration:\s*(\d+):(\d{2}):(\d{2}(?:\.\d+)?)/);
      if (!match) return reject(new Error('Could not read video duration'));
      const [, hh, mm, ss] = match;
      const seconds = Number(hh) * 3600 + Number(mm) * 60 + Number(ss);
      if (!isFinite(seconds)) return reject(new Error('Could not read video duration'));
      resolve(seconds);
    });
  });
}

function extractThumbnail(videoPath: string, thumbPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, [
      '-ss', '00:00:01',
      '-i', videoPath,
      '-frames:v', '1',
      '-vf', 'scale=640:-1',
      '-q:v', '3',
      '-y',
      thumbPath,
    ]);
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}`));
    });
    proc.on('error', reject);
  });
}

// Crops a landscape video to a 9:16 portrait frame, full height, keeping the
// horizontal slice the user chose in the app: x = 0 is the left edge, 1 the
// right edge. Re-encodes, so it runs only when the app asked for a crop. The
// min() keeps it safe if the video turns out not to be landscape after all
// (then nothing is cut off). The min() is quoted because a bare comma
// separates filters in an ffmpeg filter graph.
function cropToPortrait(inputPath: string, outputPath: string, x: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const vf = `crop=w='min(iw,trunc(ih*9/32)*2)':h=trunc(ih/2)*2:x=(iw-ow)*${x.toFixed(4)}:y=0`;
    const proc = spawn(ffmpegPath, [
      '-i', inputPath,
      '-vf', vf,
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '128k',
      '-movflags', '+faststart',
      '-y', outputPath,
    ]);
    let stderr = '';
    proc.stderr.on('data', (chunk) => { stderr = (stderr + chunk.toString()).slice(-2000); });
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg crop exited with code ${code}: ${stderr}`));
    });
    proc.on('error', reject);
  });
}

// POST /api/app/upload-video/finalize — step 2, called after the client has PUT the
// video straight to S3 using the presigned URL from /presign. Pulls the object back
// down from S3 (same-region, fast) to validate duration and generate a thumbnail —
// the client's slow uplink is bypassed, only this server-to-S3 leg remains.
export async function POST(request: Request) {
  const appUser = getAppUserFromToken(request);
  if (!appUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    let { key } = body;
    // Optional: { crop: { x } } from app versions with the crop screen — cut a
    // landscape video down to the portrait part the user picked. Older apps
    // never send it, so their uploads are handled exactly as before.
    const cropX = typeof body?.crop?.x === 'number' && isFinite(body.crop.x)
      ? Math.min(1, Math.max(0, body.crop.x))
      : null;
    if (!key || typeof key !== 'string') {
      return NextResponse.json({ error: 'key is required' }, { status: 400 });
    }
    // Ownership check — the key must be one this user was presigned for.
    const expectedPrefix = `uploads/app-videos/${appUser.id}/`;
    if (!key.startsWith(expectedPrefix)) {
      return NextResponse.json({ error: 'Invalid key' }, { status: 403 });
    }

    // No S3 credentials on a development machine: the video is already on this
    // server's disk (written by local-put), so validate it in place.
    if (!s3Enabled() && localUploadsAllowed()) {
      return await finalizeLocal(key, cropX);
    }

    const ext = path.extname(key) || '.mp4';
    let localVideoPath = path.join(os.tmpdir(), `${randomUUID()}${ext}`);
    const thumbPath = path.join(os.tmpdir(), `${randomUUID()}_thumb.jpg`);

    await downloadFromS3(key, localVideoPath);

    // Crop first, so the duration check and thumbnail below both use the video
    // that will actually be published. The cropped file replaces the original
    // in S3 (new key under the same user prefix; the original is deleted).
    if (cropX !== null) {
      const croppedPath = path.join(os.tmpdir(), `${randomUUID()}_crop.mp4`);
      try {
        await cropToPortrait(localVideoPath, croppedPath, cropX);
        const croppedKey = key.replace(/\.[a-z0-9]+$/i, '') + '_crop.mp4';
        await uploadLargeFileToS3(croppedPath, croppedKey, 'video/mp4');
        await deleteFromS3(key).catch(() => {});
        await unlink(localVideoPath).catch(() => {});
        localVideoPath = croppedPath;
        key = croppedKey;
      } catch (err) {
        // A failed crop must not lose the upload — publish the original.
        console.error('Video crop failed, keeping the original:', err);
        await unlink(croppedPath).catch(() => {});
      }
    }
    const videoUrl = s3PublicUrl(key);

    const [durationResult, thumbnailResult] = await Promise.allSettled([
      getVideoDurationSeconds(localVideoPath),
      extractThumbnail(localVideoPath, thumbPath),
    ]);

    if (durationResult.status === 'rejected') {
      console.error('Video duration check failed:', durationResult.reason);
      await deleteFromS3(key).catch(() => {});
      await unlink(localVideoPath).catch(() => {});
      if (thumbnailResult.status === 'fulfilled') await unlink(thumbPath).catch(() => {});
      return NextResponse.json({ error: 'Could not read video file. It may be corrupted or in an unsupported format.' }, { status: 400 });
    }
    if (durationResult.value > MAX_DURATION_SECONDS) {
      await deleteFromS3(key).catch(() => {});
      await unlink(localVideoPath).catch(() => {});
      if (thumbnailResult.status === 'fulfilled') await unlink(thumbPath).catch(() => {});
      return NextResponse.json({ error: 'Video must be 2 minutes or shorter.' }, { status: 400 });
    }

    let thumbnailUrl: string | null = null;
    if (thumbnailResult.status === 'fulfilled') {
      const thumbKey = key.replace(/\.[a-z0-9]+$/i, '_thumb.jpg');
      thumbnailUrl = await uploadFileToS3(thumbPath, thumbKey, 'image/jpeg');
      await unlink(thumbPath).catch(() => {});
    }
    await unlink(localVideoPath).catch(() => {});

    return NextResponse.json({ videoUrl, thumbnailUrl }, { status: 200 });
  } catch (error: any) {
    console.error('Finalize upload error:', error);
    return NextResponse.json({ error: error.message || 'Could not finalize upload' }, { status: 500 });
  }
}

// Development-only twin of the S3 flow above (see lib/localUploads.ts): same
// crop, 2-minute limit and thumbnail, but the files live under public/ instead
// of in a bucket. Kept separate so the production path above is untouched.
async function finalizeLocal(inputKey: string, cropX: number | null) {
  let key = inputKey;
  if (!isSafeKey(key)) return NextResponse.json({ error: 'Invalid key' }, { status: 400 });

  let videoPath = localPathForKey(key);
  if (cropX !== null) {
    const croppedKey = key.replace(/.[a-z0-9]+$/i, '') + '_crop.mp4';
    const croppedPath = localPathForKey(croppedKey);
    try {
      await cropToPortrait(videoPath, croppedPath, cropX);
      await unlink(videoPath).catch(() => {});
      key = croppedKey;
      videoPath = croppedPath;
    } catch (err) {
      // A failed crop must not lose the upload - publish the original.
      console.error('Video crop failed, keeping the original:', err);
      await unlink(croppedPath).catch(() => {});
    }
  }

  const thumbKey = key.replace(/.[a-z0-9]+$/i, '_thumb.jpg');
  const thumbPath = localPathForKey(thumbKey);

  const [durationResult, thumbnailResult] = await Promise.allSettled([
    getVideoDurationSeconds(videoPath),
    extractThumbnail(videoPath, thumbPath),
  ]);

  if (durationResult.status === 'rejected') {
    console.error('Video duration check failed:', durationResult.reason);
    await unlink(videoPath).catch(() => {});
    if (thumbnailResult.status === 'fulfilled') await unlink(thumbPath).catch(() => {});
    return NextResponse.json({ error: 'Could not read video file. It may be corrupted or in an unsupported format.' }, { status: 400 });
  }
  if (durationResult.value > MAX_DURATION_SECONDS) {
    await unlink(videoPath).catch(() => {});
    if (thumbnailResult.status === 'fulfilled') await unlink(thumbPath).catch(() => {});
    return NextResponse.json({ error: 'Video must be 2 minutes or shorter.' }, { status: 400 });
  }

  return NextResponse.json({
    videoUrl: localMediaUrl(key),
    thumbnailUrl: thumbnailResult.status === 'fulfilled' ? localMediaUrl(thumbKey) : null,
  }, { status: 200 });
}
