import { NextResponse } from 'next/server';
import { createWriteStream } from 'fs';
import { mkdir, unlink, stat } from 'fs/promises';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import { requireRole } from '@/lib/auth-guard';
import { s3Enabled, uploadLargeFileToS3, videoContentType } from '@/lib/s3';
import { safeVideoExt } from '@/lib/homeSectionVideos';

export const dynamic = 'force-dynamic';
// A large video over a slow admin connection can take a while.
export const maxDuration = 3600;

// POST /api/dashboard/home-videos/upload?ext=mp4 — server-side fallback for
// uploading a video. Used when direct-to-S3 isn't available: no S3 configured
// (local dev), or the browser's direct PUT was refused. The request body is the
// raw file (not multipart) and there is no size limit, so it is streamed to
// disk as it arrives — never held in memory — then moved to S3 when
// configured, or kept under public/uploads/home-videos otherwise. Excluded from
// src/middleware.ts for the same reason (middleware would buffer the body).
export async function POST(request: Request) {
  const { error } = requireRole(request, ['SUPERADMIN']);
  if (error) return error;

  let tmpPath: string | null = null;
  let filePath: string | null = null;
  try {
    const ext = safeVideoExt(new URL(request.url).searchParams.get('ext'));
    if (!ext) return NextResponse.json({ message: 'Video must be MP4, MOV, M4V or WebM' }, { status: 400 });
    if (!request.body) return NextResponse.json({ message: 'No video file received' }, { status: 400 });

    const fileName = `${Date.now()}_${randomUUID().slice(0, 8)}.${ext}`;

    if (s3Enabled()) {
      tmpPath = path.join(os.tmpdir(), `home-video-${fileName}`);
      await pipeline(Readable.fromWeb(request.body as any), createWriteStream(tmpPath));
      if ((await stat(tmpPath)).size === 0) return NextResponse.json({ message: 'No video file received' }, { status: 400 });
      const videoUrl = await uploadLargeFileToS3(tmpPath, `uploads/home-videos/${fileName}`, videoContentType(ext));
      return NextResponse.json({ videoUrl });
    }

    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'home-videos');
    await mkdir(uploadDir, { recursive: true });
    filePath = path.join(uploadDir, fileName);
    await pipeline(Readable.fromWeb(request.body as any), createWriteStream(filePath));
    if ((await stat(filePath)).size === 0) return NextResponse.json({ message: 'No video file received' }, { status: 400 });

    const serverUrl = process.env.SERVER_URL || 'http://localhost:3000';
    const videoUrl = `${serverUrl}/uploads/home-videos/${fileName}`;
    filePath = null; // keep it
    return NextResponse.json({ videoUrl });
  } catch (e: any) {
    console.error('Home video upload error:', e);
    return NextResponse.json({ message: e.message || 'Upload failed' }, { status: 500 });
  } finally {
    if (tmpPath) await unlink(tmpPath).catch(() => {});
    // An interrupted or empty local upload — don't leave a partial file behind.
    if (filePath) await unlink(filePath).catch(() => {});
  }
}
