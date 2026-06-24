import { NextResponse } from 'next/server';
import { verify } from 'jsonwebtoken';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ffmpegPath: string = require('ffmpeg-static');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const MAX_BYTES  = 150 * 1024 * 1024; // 150 MB

export const dynamic     = 'force-dynamic';
export const maxDuration = 60;

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
    const file      = formData.get('video') as File | null;
    const studentId = formData.get('studentId') as string | null;

    if (!file || file.size === 0) {
      return NextResponse.json({ error: 'No video file received' }, { status: 400 });
    }
    if (!studentId) {
      return NextResponse.json({ error: 'studentId is required' }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Video exceeds 150 MB limit' }, { status: 413 });
    }

    const ext       = (file.name.split('.').pop() || 'mp4').toLowerCase();
    const baseName  = `${Date.now()}_school_${school.id.slice(0, 8)}`;
    const fileName  = `${baseName}.${ext}`;
    const thumbName = `${baseName}_thumb.jpg`;
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'videos', studentId);
    const filePath  = path.join(uploadDir, fileName);
    const thumbPath = path.join(uploadDir, thumbName);

    await mkdir(uploadDir, { recursive: true });

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

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
