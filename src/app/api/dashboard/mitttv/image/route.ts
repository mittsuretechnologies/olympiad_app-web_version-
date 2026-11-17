import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { requireAdmin } from '@/lib/auth-guard';
import { detectImageExtension } from '@/lib/fileSignature';
import { imageContentType } from '@/lib/s3';
import { storeMittTvFile } from '@/lib/mittTv';

const MAX_BYTES = 8 * 1024 * 1024;

export const dynamic = 'force-dynamic';

// POST /api/dashboard/mitttv/image (form field "image") — a MittTV thumbnail
// or poster. Returns { imageUrl }.
export async function POST(request: Request) {
  const { error } = await requireAdmin(request, 'mittTv');
  if (error) return error;
  try {
    const form = await request.formData();
    const file = form.get('image') as File | null;
    if (!file || file.size === 0) return NextResponse.json({ message: 'No image file received' }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ message: 'Image exceeds 8 MB limit' }, { status: 413 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = detectImageExtension(buffer);
    if (!ext) return NextResponse.json({ message: 'File must be a JPG, PNG, GIF or WebP image' }, { status: 400 });

    const name = `${Date.now()}_${randomUUID().slice(0, 8)}.${ext}`;
    return NextResponse.json({ imageUrl: await storeMittTvFile(buffer, name, imageContentType(ext)) });
  } catch (e: any) {
    console.error('MittTV image upload error:', e);
    return NextResponse.json({ message: e.message || 'Upload failed' }, { status: 500 });
  }
}
