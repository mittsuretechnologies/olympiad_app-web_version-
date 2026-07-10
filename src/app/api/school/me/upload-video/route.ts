import { NextResponse } from 'next/server';
import { verify } from 'jsonwebtoken';
import { writeFile, mkdir, unlink, stat, rename } from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import { probeVideo, cropTo9x16, compressVideo } from '@/lib/videoProbe';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ffmpegPath: string = require('ffmpeg-static');

const JWT_SECRET      = process.env.JWT_SECRET || 'your-secret-key';
const MAX_BYTES       = 150 * 1024 * 1024; // 150 MB — above this, auto-compress (no hard upper cap)
const MAX_DURATION_S  = 120; // 2 minutes
const TARGET_RATIO    = 9 / 16;
const RATIO_TOLERANCE = 0.04; // ~4% slack for slightly-off exports

export const dynamic     = 'force-dynamic';
export const maxDuration = 120;

function getSchoolFromToken(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  try {
    const decoded = verify(token, JWT_SECRET) as any;
    if (decoded.role !== 'SCHOOL') return null;
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
  const school = getSchoolFromToken(request);
  if (!school) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData  = await request.formData();
    const file       = formData.get('video') as File | null;
    const studentId  = formData.get('studentId') as string | null;
    const autoCrop   = formData.get('autoCrop') === 'true';

    if (!file || file.size === 0) {
      return NextResponse.json({ error: 'No video file received' }, { status: 400 });
    }
    if (!studentId) {
      return NextResponse.json({ error: 'studentId is required' }, { status: 400 });
    }

    const ext        = (file.name.split('.').pop() || 'mp4').toLowerCase();
    const baseName    = `${Date.now()}_school_${school.id.slice(0, 8)}`;
    const rawFileName = `${baseName}_raw.${ext}`;
    const fileName    = `${baseName}.mp4`;
    const thumbName   = `${baseName}_thumb.jpg`;
    const uploadDir   = path.join(process.cwd(), 'public', 'uploads', 'videos', studentId);
    const rawPath     = path.join(uploadDir, rawFileName);
    const filePath    = path.join(uploadDir, fileName);
    const thumbPath   = path.join(uploadDir, thumbName);

    await mkdir(uploadDir, { recursive: true });

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(rawPath, buffer);

    // ── Validate duration + aspect ratio ──────────────────────────────────────
    let meta;
    try {
      meta = await probeVideo(rawPath);
    } catch (probeError: any) {
      console.error('probeVideo failed for', rawPath, ':', probeError?.message || probeError);
      await unlink(rawPath).catch(() => {});
      return NextResponse.json({ error: 'Could not read video file. It may be corrupted or in an unsupported format.' }, { status: 400 });
    }

    if (meta.durationSeconds > MAX_DURATION_S) {
      await unlink(rawPath).catch(() => {});
      return NextResponse.json({ error: 'Video must be 2 minutes or shorter.' }, { status: 400 });
    }

    const ratio = meta.width / meta.height;
    const isPortrait916 = Math.abs(ratio - TARGET_RATIO) <= RATIO_TOLERANCE;

    let workingPath = rawPath;

    if (!isPortrait916) {
      if (!autoCrop) {
        await unlink(rawPath).catch(() => {});
        return NextResponse.json({
          error: 'Video must be in 9:16 (portrait) format. Enable auto-crop to fix this automatically.',
          code: 'ASPECT_RATIO_MISMATCH',
        }, { status: 400 });
      }
      const croppedPath = path.join(uploadDir, `${baseName}_cropped.mp4`);
      try {
        await cropTo9x16(rawPath, croppedPath);
      } catch {
        await unlink(rawPath).catch(() => {});
        return NextResponse.json({ error: 'Failed to auto-crop video to 9:16.' }, { status: 500 });
      }
      await unlink(rawPath).catch(() => {});
      workingPath = croppedPath;
    }

    // ── Compress if over the soft size limit ──────────────────────────────────
    const { size: workingSize } = await stat(workingPath);
    if (workingSize > MAX_BYTES) {
      const targetBitrateKbps = Math.max(
        800,
        Math.floor((MAX_BYTES * 8) / meta.durationSeconds / 1000 * 0.9) // 10% headroom under target
      );
      const compressedPath = path.join(uploadDir, `${baseName}_compressed.mp4`);
      try {
        await compressVideo(workingPath, compressedPath, targetBitrateKbps);
      } catch {
        await unlink(workingPath).catch(() => {});
        return NextResponse.json({ error: 'Video is too large and automatic compression failed. Please upload a smaller file.' }, { status: 413 });
      }
      await unlink(workingPath).catch(() => {});
      workingPath = compressedPath;
    }

    // Move the final working file into place as the canonical fileName
    if (workingPath !== filePath) {
      await rename(workingPath, filePath);
    }

    const serverUrl = process.env.SERVER_URL || 'http://localhost:3000';
    const videoUrl  = `${serverUrl}/uploads/videos/${studentId}/${fileName}`;
    let thumbnailUrl: string | null = null;

    try {
      await extractThumbnail(filePath, thumbPath);
      thumbnailUrl = `${serverUrl}/uploads/videos/${studentId}/${thumbName}`;
    } catch {
      // thumbnail generation is best-effort; upload still succeeds without it
    }

    return NextResponse.json({ videoUrl, thumbnailUrl }, { status: 200 });
  } catch (error: any) {
    console.error('School upload route error:', error);
    return NextResponse.json({ error: error.message || 'Upload failed' }, { status: 500 });
  }
}
