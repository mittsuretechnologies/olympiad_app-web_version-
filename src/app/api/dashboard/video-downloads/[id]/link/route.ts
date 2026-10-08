import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth-guard';
import { getJwtSecret } from '@/lib/jwt-secret';
import { getSignedDownloadUrl } from '@/lib/s3';
import { recordAuditLog } from '@/lib/audit-log';
import { DOWNLOAD_TOKEN_PURPOSE, downloadFileName } from '@/lib/videoDownloads';

export const dynamic = 'force-dynamic';

// GET /api/dashboard/video-downloads/:id/link — a URL the dashboard hands to
// the browser to save the video as a file. A browser download can't carry the
// Authorization header, so the URL itself is the short-lived credential: a
// presigned S3 link (the file comes straight from S3, not through this
// server), or — for a file not in our bucket — this app's ../file route with
// a 10-minute token. Every download is written to the Activity Log.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error, payload } = requireRole(request, ['SUPERADMIN']);
  if (error) return error;

  try {
    const { id } = await params;
    const video = await prisma.video.findUnique({
      where: { id },
      select: {
        id: true, videoUrl: true, appUserId: true, category: true, createdAt: true,
        student: { select: { name: true } },
      },
    });
    if (!video) return NextResponse.json({ message: 'Video not found' }, { status: 404 });

    const appUser = video.appUserId
      ? await prisma.appUser.findUnique({ where: { id: video.appUserId }, select: { userId: true } })
      : null;
    const fileName = downloadFileName(
      appUser?.userId ?? video.student?.name, video.category, video.createdAt, video.id, video.videoUrl,
    );

    let url = await getSignedDownloadUrl(video.videoUrl, fileName);
    if (!url) {
      const t = jwt.sign({ purpose: DOWNLOAD_TOKEN_PURPOSE, videoId: video.id }, getJwtSecret(), { expiresIn: '10m' });
      url = `/api/dashboard/video-downloads/${video.id}/file?t=${encodeURIComponent(t)}`;
    }

    await recordAuditLog({
      actorId: payload!.id,
      actorRole: payload!.role,
      actorName: payload!.name || payload!.email || null,
      action: 'VIDEO_DOWNLOADED',
      entityType: 'Video',
      entityId: video.id,
      newValue: { fileName },
    });

    return NextResponse.json({ url, fileName });
  } catch (e: any) {
    console.error('video-downloads link error:', e);
    return NextResponse.json({ message: e.message || 'Could not prepare the download' }, { status: 500 });
  }
}
