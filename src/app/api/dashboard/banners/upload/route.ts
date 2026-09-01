import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { requireRole } from '@/lib/auth-guard';
import { detectImageExtension } from '@/lib/fileSignature';
import { s3Enabled, uploadBufferToS3, imageContentType } from '@/lib/s3';

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB — banner art tends to be larger than avatars

export const dynamic = 'force-dynamic';

// Shared upload endpoint for both the desktop and mobile banner images —
// `field` in the form data just labels which slot the file is for so the
// admin UI can call this once per image without two near-duplicate routes.
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
      return NextResponse.json({ message: 'Image exceeds 8 MB limit' }, { status: 413 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = detectImageExtension(buffer);
    if (!ext) {
      return NextResponse.json({ message: 'File must be a valid JPG, PNG, GIF, or WebP image' }, { status: 400 });
    }

    const fileName = `${Date.now()}_${randomUUID().slice(0, 8)}.${ext}`;

    if (s3Enabled()) {
      const imageUrl = await uploadBufferToS3(
        buffer, `uploads/banners/${fileName}`, imageContentType(ext),
      );
      return NextResponse.json({ imageUrl }, { status: 200 });
    }

    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'banners');
    const filePath = path.join(uploadDir, fileName);

    await mkdir(uploadDir, { recursive: true });
    await writeFile(filePath, buffer);

    const serverUrl = process.env.SERVER_URL || 'http://localhost:3000';
    const imageUrl = `${serverUrl}/uploads/banners/${fileName}`;

    return NextResponse.json({ imageUrl }, { status: 200 });
  } catch (error: any) {
    console.error('Banner upload error:', error);
    return NextResponse.json({ message: error.message || 'Upload failed' }, { status: 500 });
  }
}
