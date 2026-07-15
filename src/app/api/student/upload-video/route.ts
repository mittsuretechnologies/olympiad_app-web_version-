import { NextResponse } from 'next/server';
import { verify } from 'jsonwebtoken';
import { writeFile, mkdir, unlink } from 'fs/promises';
import path from 'path';
import { probeVideo } from '@/lib/videoProbe';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';
const MAX_BYTES  = 150 * 1024 * 1024; // 150 MB
const MAX_DURATION_S = 120; // 2 minutes

export const dynamic    = 'force-dynamic';
export const maxDuration = 60;

function getStudentFromToken(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  try {
    const decoded = verify(token, JWT_SECRET) as any;
    if (decoded.role !== 'student' && decoded.role !== 'STUDENT') return null;
    return decoded;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const student = getStudentFromToken(request);
  if (!student) {
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

    const fileName  = `${Date.now()}_${student.id.slice(0, 8)}.mp4`;
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'videos', student.id);
    const filePath  = path.join(uploadDir, fileName);

    await mkdir(uploadDir, { recursive: true });

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    // Confirm this is actually a decodable video (not e.g. an HTML/script file
    // renamed with a video extension) before keeping it under public/uploads.
    let meta;
    try {
      meta = await probeVideo(filePath);
    } catch {
      await unlink(filePath).catch(() => {});
      return NextResponse.json({ error: 'Could not read video file. It may be corrupted or in an unsupported format.' }, { status: 400 });
    }
    if (meta.durationSeconds > MAX_DURATION_S) {
      await unlink(filePath).catch(() => {});
      return NextResponse.json({ error: 'Video must be 2 minutes or shorter.' }, { status: 400 });
    }

    const serverUrl = process.env.SERVER_URL || 'http://localhost:3000';
    const videoUrl  = `${serverUrl}/uploads/videos/${student.id}/${fileName}`;

    return NextResponse.json({ videoUrl }, { status: 200 });
  } catch (error: any) {
    console.error('Upload route error:', error);
    return NextResponse.json({ error: error.message || 'Upload failed' }, { status: 500 });
  }
}
