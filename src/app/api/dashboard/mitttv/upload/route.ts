import { NextResponse } from 'next/server';
import { createWriteStream } from 'fs';
import { mkdir, unlink, stat } from 'fs/promises';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import { requireAdmin } from '@/lib/auth-guard';
import { s3Enabled, uploadLargeFileToS3, videoContentType } from '@/lib/s3';
import { MITTTV_MEDIA_PREFIX, mittTvLocalDir, mittTvLocalUrl, safeMittTvExt } from '@/lib/mittTv';

export const dynamic = 'force-dynamic';
// A large video over a slow admin connection can take a while.
export const maxDuration = 3600;

// POST /api/dashboard/mitttv/upload?ext=mp4 — the server-side fallback for a
// MittTV video, used when direct-to-S3 isn't available (no S3 in local
// development, or the browser's PUT was refused). The body is the raw file, so
// it is streamed to disk as it arrives, never held in memory, then moved to S3
// when configured or kept under public/uploads/mitttv. Excluded from
// src/middleware.ts, which would buffer the body and cut it off.
export async function POST(request: Request) {
  const { error } = await requireAdmin(request, 'mittTv');
  if (error) return error;

  let tmpPath: string | null = null;
  let filePath: string | null = null;
  try {
    const ext = safeMittTvExt(new URL(request.url).searchParams.get('ext'));
    if (!ext) return NextResponse.json({ message: 'Video must be MP4, MOV, M4V or WebM' }, { status: 400 });
    if (!request.body) return NextResponse.json({ message: 'No video file received' }, { status: 400 });

    const fileName = `${Date.now()}_${randomUUID().slice(0, 8)}.${ext}`;

    if (s3Enabled()) {
      tmpPath = path.join(os.tmpdir(), `mitttv-${fileName}`);
      await pipeline(Readable.fromWeb(request.body as any), createWriteStream(tmpPath));
      if ((await stat(tmpPath)).size === 0) return NextResponse.json({ message: 'No video file received' }, { status: 400 });
      const videoUrl = await uploadLargeFileToS3(tmpPath, `${MITTTV_MEDIA_PREFIX}${fileName}`, videoContentType(ext));
      return NextResponse.json({ videoUrl });
    }

    await mkdir(mittTvLocalDir(), { recursive: true });
    filePath = path.join(mittTvLocalDir(), fileName);
    await pipeline(Readable.fromWeb(request.body as any), createWriteStream(filePath));
    if ((await stat(filePath)).size === 0) return NextResponse.json({ message: 'No video file received' }, { status: 400 });
    filePath = null; // keep it
    return NextResponse.json({ videoUrl: mittTvLocalUrl(fileName) });
  } catch (e: any) {
    console.error('MittTV video upload error:', e);
    return NextResponse.json({ message: e.message || 'Upload failed' }, { status: 500 });
  } finally {
    if (tmpPath) await unlink(tmpPath).catch(() => {});
    // An interrupted or empty local upload: don't leave a partial file behind.
    if (filePath) await unlink(filePath).catch(() => {});
  }
}
