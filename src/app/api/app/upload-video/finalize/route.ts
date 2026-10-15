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
import { optimizeForStreaming } from '@/lib/videoOptimize';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ffmpegPath: string = require('ffmpeg-static');

const JWT_SECRET = getJwtSecret();
const MAX_DURATION_SECONDS = 120;

export const dynamic     = 'force-dynamic';
// Shrinking / cropping re-encodes the video (capped at 150 s inside the helper),
// which takes much longer than the old duration + thumbnail checks alone.
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

    // Length first: an over-long or unreadable video is refused before any
    // encoding work is spent on it.
    try {
      const seconds = await getVideoDurationSeconds(localVideoPath);
      if (seconds > MAX_DURATION_SECONDS) {
        await deleteFromS3(key).catch(() => {});
        await unlink(localVideoPath).catch(() => {});
        return NextResponse.json({ error: 'Video must be 2 minutes or shorter.' }, { status: 400 });
      }
    } catch (err) {
      console.error('Video duration check failed:', err);
      await deleteFromS3(key).catch(() => {});
      await unlink(localVideoPath).catch(() => {});
      return NextResponse.json({ error: 'Could not read video file. It may be corrupted or in an unsupported format.' }, { status: 400 });
    }

    // Make it light enough for a phone to stream (and apply the crop, if the
    // user chose one) in a single pass. An already-light video is untouched.
    // The ORIGINAL stays in S3 under its own key; only the published link
    // points at the optimised copy.
    const optimisedPath = path.join(os.tmpdir(), `${randomUUID()}_opt.mp4`);
    const outcome = await optimizeForStreaming(localVideoPath, optimisedPath, cropX);
    if (outcome === 'remux' || outcome === 'encode') {
      const optKey = key.replace(/\.[a-z0-9]+$/i, '') + '_opt.mp4';
      try {
        await uploadLargeFileToS3(optimisedPath, optKey, 'video/mp4');
        await unlink(localVideoPath).catch(() => {});
        localVideoPath = optimisedPath;
        key = optKey;
      } catch (err) {
        console.error('Uploading the optimised video failed, publishing the original:', err);
        await unlink(optimisedPath).catch(() => {});
      }
    }
    const videoUrl = s3PublicUrl(key);

    const thumbnailResult = await Promise.allSettled([
      extractThumbnail(localVideoPath, thumbPath),
    ]).then((r) => r[0]);

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
// 2-minute limit, optimise-and-crop pass and thumbnail, but the files live
// under public/ instead of in a bucket. Kept separate so the production path
// above is untouched.
async function finalizeLocal(inputKey: string, cropX: number | null) {
  let key = inputKey;
  if (!isSafeKey(key)) return NextResponse.json({ error: 'Invalid key' }, { status: 400 });

  let videoPath = localPathForKey(key);

  try {
    const seconds = await getVideoDurationSeconds(videoPath);
    if (seconds > MAX_DURATION_SECONDS) {
      await unlink(videoPath).catch(() => {});
      return NextResponse.json({ error: 'Video must be 2 minutes or shorter.' }, { status: 400 });
    }
  } catch (err) {
    console.error('Video duration check failed:', err);
    await unlink(videoPath).catch(() => {});
    return NextResponse.json({ error: 'Could not read video file. It may be corrupted or in an unsupported format.' }, { status: 400 });
  }

  // Shrink / crop in one pass. The original file stays next to the copy.
  const optKey = key.replace(/\.[a-z0-9]+$/i, '') + '_opt.mp4';
  const optPath = localPathForKey(optKey);
  const outcome = await optimizeForStreaming(videoPath, optPath, cropX);
  if (outcome === 'remux' || outcome === 'encode') {
    key = optKey;
    videoPath = optPath;
  }

  const thumbKey = key.replace(/\.[a-z0-9]+$/i, '_thumb.jpg');
  const thumbPath = localPathForKey(thumbKey);
  const thumbnailResult = await Promise.allSettled([extractThumbnail(videoPath, thumbPath)]).then((r) => r[0]);

  return NextResponse.json({
    videoUrl: localMediaUrl(key),
    thumbnailUrl: thumbnailResult.status === 'fulfilled' ? localMediaUrl(thumbKey) : null,
  }, { status: 200 });
}
