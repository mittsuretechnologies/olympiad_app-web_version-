import { NextResponse } from 'next/server';
import { verify } from 'jsonwebtoken';
import { unlink } from 'fs/promises';
import path from 'path';
import os from 'os';
import { randomUUID } from 'crypto';
import { spawn } from 'child_process';
import { s3PublicUrl, uploadFileToS3, deleteFromS3, downloadFromS3 } from '@/lib/s3';
import { getJwtSecret } from '@/lib/auth-guard';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ffmpegPath: string = require('ffmpeg-static');

const JWT_SECRET = getJwtSecret();
const MAX_DURATION_SECONDS = 120;

export const dynamic     = 'force-dynamic';
export const maxDuration  = 60;

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
    const { key } = await request.json();
    if (!key || typeof key !== 'string') {
      return NextResponse.json({ error: 'key is required' }, { status: 400 });
    }
    // Ownership check — the key must be one this user was presigned for.
    const expectedPrefix = `uploads/app-videos/${appUser.id}/`;
    if (!key.startsWith(expectedPrefix)) {
      return NextResponse.json({ error: 'Invalid key' }, { status: 403 });
    }

    const videoUrl = s3PublicUrl(key);
    const ext = path.extname(key) || '.mp4';
    const localVideoPath = path.join(os.tmpdir(), `${randomUUID()}${ext}`);
    const thumbPath = path.join(os.tmpdir(), `${randomUUID()}_thumb.jpg`);

    await downloadFromS3(key, localVideoPath);

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
