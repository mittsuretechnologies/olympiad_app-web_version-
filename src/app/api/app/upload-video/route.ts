import { NextResponse } from 'next/server';
import { verify } from 'jsonwebtoken';
import { writeFile, mkdir, unlink } from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
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

    try {
      const durationSeconds = await getVideoDurationSeconds(filePath);
      if (durationSeconds > MAX_DURATION_SECONDS) {
        await unlink(filePath).catch(() => {});
        return NextResponse.json({ error: 'Video must be 2 minutes or shorter.' }, { status: 400 });
      }
    } catch (durationError) {
      // Could not read duration (corrupt file / unsupported codec) — reject rather than upload an unverifiable video.
      console.error('Video duration check failed:', durationError);
      await unlink(filePath).catch(() => {});
      return NextResponse.json({ error: 'Could not verify video duration. Please try a different file.' }, { status: 400 });
    }

    const serverUrl  = process.env.SERVER_URL || 'http://localhost:3000';
    const videoUrl   = `${serverUrl}/uploads/app-videos/${appUser.id}/${fileName}`;
    let thumbnailUrl: string | null = null;

    try {
      await extractThumbnail(filePath, thumbPath);
      thumbnailUrl = `${serverUrl}/uploads/app-videos/${appUser.id}/${thumbName}`;
    } catch {
      // thumbnail generation is best-effort; upload still succeeds without it
    }

    return NextResponse.json({ videoUrl, thumbnailUrl }, { status: 200 });
  } catch (error: any) {
    console.error('App upload error:', error);
    return NextResponse.json({ error: error.message || 'Upload failed' }, { status: 500 });
  }
}
