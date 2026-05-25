import { NextResponse } from 'next/server';
import { verify } from 'jsonwebtoken';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const MAX_BYTES  = 150 * 1024 * 1024; // 150 MB

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

    // Save to  <project-root>/public/uploads/videos/<studentId>/
    // Next.js serves everything inside /public as static files automatically.
    // When you move to your own server, replace the writeFile block below
    // with an upload call to that server — everything else stays the same.
    const ext       = (file.name.split('.').pop() || 'mp4').toLowerCase();
    const fileName  = `${Date.now()}_${student.id.slice(0, 8)}.${ext}`;
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'videos', student.id);
    const filePath  = path.join(uploadDir, fileName);

    // Create the directory if it doesn't exist
    await mkdir(uploadDir, { recursive: true });

    // Write the file to disk
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    // Build the public URL the mobile app and dashboard will use to stream the video.
    // SERVER_URL must be set in .env to your machine's local IP when testing on a
    // real device (e.g. http://192.168.1.5:3000). On production, set it to your
    // domain (e.g. https://yourserver.com).
    const serverUrl = process.env.SERVER_URL || 'http://localhost:3000';
    const videoUrl  = `${serverUrl}/uploads/videos/${student.id}/${fileName}`;

    return NextResponse.json({ videoUrl }, { status: 200 });
  } catch (error: any) {
    console.error('Upload route error:', error);
    return NextResponse.json({ error: error.message || 'Upload failed' }, { status: 500 });
  }
}
