import { NextResponse } from 'next/server';
import { verify } from 'jsonwebtoken';
import { writeFile, mkdir, unlink } from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import { s3Enabled, uploadFileToS3, videoContentType } from '@/lib/s3';
// ffmpeg-static resolves to the platform binary path at runtime (no Next.js bundler issues)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ffmpegPath: string = require('ffmpeg-static');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';
const MAX_BYTES  = 150 * 1024 * 1024;
const MAX_DURATION_SECONDS = 120;

// No ffprobe binary is bundled with this project (ffmpeg-static only ships ffmpeg) —
// read duration straight from ffmpeg's own stderr "Duration: HH:MM:SS.ms" line instead.
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

export const dynamic     = 'force-dynamic';
export const maxDuration = 60;

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

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, args);
    let stderr = '';
    proc.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-500)}`));
    });
    proc.on('error', reject);
  });
}

function extractThumbnailPlain(videoPath: string, thumbPath: string): Promise<void> {
  return runFfmpeg([
    '-ss', '00:00:01',
    '-i', videoPath,
    '-frames:v', '1',
    '-vf', 'scale=640:-1',
    '-q:v', '3',
    '-y',
    thumbPath,
  ]);
}

// Some phones/camera apps write an H.264 color_range value ffmpeg's own
// filter graph refuses to negotiate ("Invalid color range"), which fails
// EVERY frame extraction from that file — confirmed reproducible against a
// real uploaded video, not a rare flake. The stream data itself is fine
// (stream-copy works); only decode-time color negotiation chokes on the tag.
//
// Fix: rewrite just the container's color metadata via the h264_metadata
// bitstream filter (a fast, lossless remux — no re-encoding of the actual
// video) to standard values, then extract the frame from THAT file. This
// can't be done in a single ffmpeg invocation: the bsf rewrites metadata at
// the packet level, but the decoder still reads the original stream's
// (uncorrected) container-level tag at filter-graph init time on the same
// pass — the metadata has to actually be persisted to a new container first.
async function extractThumbnailWithColorRangeFix(videoPath: string, thumbPath: string): Promise<void> {
  const remuxedPath = `${videoPath}.range-fixed.mp4`;
  try {
    await runFfmpeg([
      '-i', videoPath,
      '-bsf:v', 'h264_metadata=video_full_range_flag=0:colour_primaries=1:transfer_characteristics=1:matrix_coefficients=1',
      '-c', 'copy',
      '-y',
      remuxedPath,
    ]);
    await extractThumbnailPlain(remuxedPath, thumbPath);
  } finally {
    await unlink(remuxedPath).catch(() => {});
  }
}

async function extractThumbnail(videoPath: string, thumbPath: string): Promise<void> {
  try {
    await extractThumbnailPlain(videoPath, thumbPath);
  } catch (err) {
    // Only worth retrying for the specific known failure mode — anything
    // else (corrupt file, unsupported codec entirely) will fail the same
    // way again and shouldn't cost a second ffmpeg pass.
    if (err instanceof Error && err.message.includes('Invalid color range')) {
      await extractThumbnailWithColorRangeFix(videoPath, thumbPath);
    } else {
      throw err;
    }
  }
}

export async function POST(request: Request) {
  const appUser = getAppUserFromToken(request);
  if (!appUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file     = formData.get('video') as File | null;

    if (!file || file.size === 0) {
      return NextResponse.json({ error: 'No video file received' }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Video exceeds 150 MB limit' }, { status: 413 });
    }

    const ext       = (file.name.split('.').pop() || 'mp4').toLowerCase();
    const baseName  = `${Date.now()}_${appUser.id.slice(0, 8)}`;
    const fileName  = `${baseName}.${ext}`;
    const thumbName = `${baseName}_thumb.jpg`;
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'app-videos', appUser.id);
    const filePath  = path.join(uploadDir, fileName);
    const thumbPath = path.join(uploadDir, thumbName);

    await mkdir(uploadDir, { recursive: true });

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    // Duration check and thumbnail extraction are independent ffmpeg passes over the
    // same file — run them concurrently instead of back-to-back to roughly halve the
    // server-side processing time the client has to wait out after the upload completes.
    const [durationResult, thumbnailResult] = await Promise.allSettled([
      getVideoDurationSeconds(filePath),
      extractThumbnail(filePath, thumbPath),
    ]);

    if (durationResult.status === 'rejected') {
      // Could not read duration (corrupt file / unsupported codec) — reject rather than upload an unverifiable video.
      console.error('Video duration check failed:', durationResult.reason);
      await unlink(filePath).catch(() => {});
      if (thumbnailResult.status === 'fulfilled') await unlink(thumbPath).catch(() => {});
      return NextResponse.json({ error: 'Could not verify video duration. Please try a different file.' }, { status: 400 });
    }
    if (durationResult.value > MAX_DURATION_SECONDS) {
      await unlink(filePath).catch(() => {});
      if (thumbnailResult.status === 'fulfilled') await unlink(thumbPath).catch(() => {});
      return NextResponse.json({ error: 'Video must be 2 minutes or shorter.' }, { status: 400 });
    }

    // Thumbnail generation is best-effort; upload still succeeds without it.
    const thumbCreated = thumbnailResult.status === 'fulfilled';

    if (s3Enabled()) {
      const keyBase  = `uploads/app-videos/${appUser.id}`;
      const videoUrl = await uploadFileToS3(filePath, `${keyBase}/${fileName}`, videoContentType(ext));
      let thumbnailUrl: string | null = null;
      if (thumbCreated) {
        thumbnailUrl = await uploadFileToS3(thumbPath, `${keyBase}/${thumbName}`, 'image/jpeg');
      }
      await unlink(filePath).catch(() => {});
      if (thumbCreated) await unlink(thumbPath).catch(() => {});
      return NextResponse.json({ videoUrl, thumbnailUrl }, { status: 200 });
    }

    const serverUrl  = process.env.SERVER_URL || 'http://localhost:3000';
    const videoUrl   = `${serverUrl}/uploads/app-videos/${appUser.id}/${fileName}`;
    const thumbnailUrl = thumbCreated
      ? `${serverUrl}/uploads/app-videos/${appUser.id}/${thumbName}`
      : null;

    return NextResponse.json({ videoUrl, thumbnailUrl }, { status: 200 });
  } catch (error: any) {
    console.error('App upload error:', error);
    return NextResponse.json({ error: error.message || 'Upload failed' }, { status: 500 });
  }
}
