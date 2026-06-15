import { NextResponse } from 'next/server';
import { verify } from 'jsonwebtoken';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

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
    const fileName  = `${Date.now()}_school_${school.id.slice(0, 8)}.${ext}`;
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'videos', studentId);
    const filePath  = path.join(uploadDir, fileName);

    await mkdir(uploadDir, { recursive: true });

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    const serverUrl = process.env.SERVER_URL || 'http://localhost:3000';
    const videoUrl  = `${serverUrl}/uploads/videos/${studentId}/${fileName}`;

    return NextResponse.json({ videoUrl }, { status: 200 });
  } catch (error: any) {
    console.error('School upload route error:', error);
    return NextResponse.json({ error: error.message || 'Upload failed' }, { status: 500 });
  }
}
