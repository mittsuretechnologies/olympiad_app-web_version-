import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import { Readable } from 'stream';
import path from 'path';
import { prisma } from '@/lib/prisma';
import { getJwtSecret } from '@/lib/jwt-secret';
import { DOWNLOAD_TOKEN_PURPOSE, downloadFileName } from '@/lib/videoDownloads';

export const dynamic = 'force-dynamic';
export const maxDuration = 3600;

// GET /api/dashboard/video-downloads/:id/file?t=<token> — serves a video as a
// file download when it isn't in our S3 bucket (local development, or an
// older URL). The token comes from ../link (SuperAdmin only, 10 minutes, this
// video only). Files under public/uploads are streamed from disk; anything
// else is streamed through from its stored URL.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const t = new URL(request.url).searchParams.get('t') || '';
  try {
    const claims = jwt.verify(t, getJwtSecret()) as any;
    if (claims?.purpose !== DOWNLOAD_TOKEN_PURPOSE || claims?.videoId !== id) throw new Error('bad token');
  } catch {
    return NextResponse.json({ message: 'This download link has expired. Please try again.' }, { status: 401 });
  }

  const video = await prisma.video.findUnique({
    where: { id },
    select: { id: true, videoUrl: true, appUserId: true, category: true, createdAt: true, student: { select: { name: true } } },
  });
  if (!video) return NextResponse.json({ message: 'Video not found' }, { status: 404 });

  const appUser = video.appUserId
    ? await prisma.appUser.findUnique({ where: { id: video.appUserId }, select: { userId: true } })
    : null;
  const fileName = downloadFileName(appUser?.userId ?? video.student?.name, video.category, video.createdAt, video.id, video.videoUrl);
  const headers: Record<string, string> = {
    'Content-Type': 'application/octet-stream',
    'Content-Disposition': `attachment; filename="${fileName}"`,
    'Cache-Control': 'no-store',
  };

  try {
    // Our own /uploads/... files → straight from disk.
    const pathname = new URL(video.videoUrl, 'http://local').pathname;
    if (pathname.startsWith('/uploads/')) {
      const publicDir = path.join(process.cwd(), 'public');
      const filePath = path.normalize(path.join(publicDir, decodeURIComponent(pathname)));
      if (filePath.startsWith(publicDir + path.sep)) {
        const info = await stat(filePath).catch(() => null);
        if (info?.isFile()) {
          return new Response(Readable.toWeb(createReadStream(filePath)) as any, {
            headers: { ...headers, 'Content-Length': String(info.size) },
          });
        }
      }
    }

    // Anywhere else → pass it through.
    if (!/^https?:\/\//.test(video.videoUrl)) return NextResponse.json({ message: 'Video file not found' }, { status: 404 });
    const upstream = await fetch(video.videoUrl);
    if (!upstream.ok || !upstream.body) {
      return NextResponse.json({ message: `Video file could not be fetched (${upstream.status})` }, { status: 502 });
    }
    const len = upstream.headers.get('content-length');
    return new Response(upstream.body, { headers: len ? { ...headers, 'Content-Length': len } : headers });
  } catch (e: any) {
    console.error('video-downloads file error:', e);
    return NextResponse.json({ message: 'Download failed' }, { status: 500 });
  }
}
