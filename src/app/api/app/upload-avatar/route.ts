import { NextResponse } from 'next/server';
import { verify } from 'jsonwebtoken';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { detectImageExtension } from '@/lib/fileSignature';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';
const MAX_BYTES  = 5 * 1024 * 1024; // 5 MB

export const dynamic = 'force-dynamic';

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

export async function POST(request: Request) {
  const appUser = getAppUserFromToken(request);
  if (!appUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file     = formData.get('avatar') as File | null;

    if (!file || file.size === 0) {
      return NextResponse.json({ error: 'No image file received' }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Image exceeds 5 MB limit' }, { status: 413 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = detectImageExtension(buffer);
    if (!ext) {
      return NextResponse.json({ error: 'File must be a valid JPG, PNG, GIF, or WebP image' }, { status: 400 });
    }

    const fileName  = `${Date.now()}_${appUser.id.slice(0, 8)}.${ext}`;
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'app-avatars', appUser.id);
    const filePath  = path.join(uploadDir, fileName);

    await mkdir(uploadDir, { recursive: true });
    await writeFile(filePath, buffer);

    const serverUrl = process.env.SERVER_URL || 'http://localhost:3000';
    const avatarUrl = `${serverUrl}/uploads/app-avatars/${appUser.id}/${fileName}`;

    return NextResponse.json({ avatarUrl }, { status: 200 });
  } catch (error: any) {
    console.error('Avatar upload error:', error);
    return NextResponse.json({ error: error.message || 'Upload failed' }, { status: 500 });
  }
}
