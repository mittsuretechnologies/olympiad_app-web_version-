import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { requireRole } from '@/lib/auth-guard';
import { detectImageExtension } from '@/lib/fileSignature';
import { s3Enabled, uploadBufferToS3, imageContentType } from '@/lib/s3';

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB — a profile photo

export const dynamic = 'force-dynamic';

// POST /api/master-admins/avatar — form field "image". Returns { imageUrl }
// for the "Custom Photo" avatar option. SuperAdmin only; same storage path
// as the banner uploads (S3 when configured, else public/uploads).
export async function POST(request: Request) {
  const { error } = requireRole(request, ['SUPERADMIN']);
  if (error) return error;

  try {
    const formData = await request.formData();
    const file = formData.get('image') as File | null;

    if (!file || file.size === 0) {
      return NextResponse.json({ message: 'No image file received' }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ message: 'Photo exceeds 2 MB limit' }, { status: 413 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = detectImageExtension(buffer);
    if (!ext) {
      return NextResponse.json({ message: 'File must be a valid JPG, PNG, GIF, or WebP image' }, { status: 400 });
    }

    const fileName = `${Date.now()}_${randomUUID().slice(0, 8)}.${ext}`;

    if (s3Enabled()) {
      const imageUrl = await uploadBufferToS3(buffer, `uploads/master-admins/${fileName}`, imageContentType(ext));
      return NextResponse.json({ imageUrl }, { status: 200 });
    }

    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'master-admins');
    await mkdir(uploadDir, { recursive: true });
    await writeFile(path.join(uploadDir, fileName), buffer);

    const serverUrl = process.env.SERVER_URL || 'http://localhost:3000';
    return NextResponse.json({ imageUrl: `${serverUrl}/uploads/master-admins/${fileName}` }, { status: 200 });
  } catch (error: any) {
    console.error('Master admin avatar upload error:', error);
    return NextResponse.json({ message: error.message || 'Upload failed' }, { status: 500 });
  }
}
