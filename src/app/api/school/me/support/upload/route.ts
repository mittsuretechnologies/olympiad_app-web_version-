import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { requireRole } from '@/lib/auth-guard';
import { detectImageExtension } from '@/lib/fileSignature';
import { s3Enabled, uploadBufferToS3, imageContentType } from '@/lib/s3';
import { SUPPORT_LIMITS, type SupportAttachment } from '@/lib/schoolSupport';

export const dynamic = 'force-dynamic';

// POST /api/school/me/support/upload — one attachment (screenshot or PDF) for
// a support request, uploaded before the message is sent. The file type is
// decided from its bytes, never from the name or Content-Type.

export async function POST(request: Request) {
  const { payload, error } = requireRole(request, ['SCHOOL']);
  if (error) return error;

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file || file.size === 0) {
      return NextResponse.json({ message: 'No file received.' }, { status: 400 });
    }
    if (file.size > SUPPORT_LIMITS.attachmentBytes) {
      return NextResponse.json({ message: 'File is larger than 5 MB.' }, { status: 413 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const isPdf = buffer.length >= 5 && buffer.subarray(0, 5).toString('ascii') === '%PDF-';
    const imageExt = isPdf ? null : detectImageExtension(buffer);
    if (!isPdf && !imageExt) {
      return NextResponse.json({ message: 'Only JPG, PNG, GIF, WebP images or PDF files can be attached.' }, { status: 400 });
    }

    const ext = isPdf ? 'pdf' : imageExt!;
    const fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const contentType = isPdf ? 'application/pdf' : imageContentType(ext);
    const originalName = (file.name || `attachment.${ext}`).replace(/[^\w.\- ()]/g, '_').slice(0, 120);

    let url: string;
    if (s3Enabled()) {
      url = await uploadBufferToS3(buffer, `uploads/school-support/${payload.id}/${fileName}`, contentType);
    } else {
      const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'school-support', payload.id);
      await mkdir(uploadDir, { recursive: true });
      await writeFile(path.join(uploadDir, fileName), buffer);
      const serverUrl = process.env.SERVER_URL || 'http://localhost:3000';
      url = `${serverUrl}/uploads/school-support/${payload.id}/${fileName}`;
    }

    const attachment: SupportAttachment = { url, name: originalName, type: isPdf ? 'pdf' : 'image' };
    return NextResponse.json({ attachment }, { status: 201 });
  } catch (err) {
    console.error('School support upload failed:', err);
    return NextResponse.json({ message: 'Upload failed. Please try again.' }, { status: 500 });
  }
}
