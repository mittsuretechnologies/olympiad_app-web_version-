import { NextResponse } from 'next/server';
import { verify } from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

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

const RETENTION_DAYS = 30;

// GET /api/app/notifications?cursor=<id>&limit=12 — list generic system notifications (e.g. video removed)
// Notifications only ever exist to be shown here, so anything past the retention window is hard-deleted
// rather than just hidden — nothing else in the app reads this table.
export async function GET(request: Request) {
  const appUser = getAppUserFromToken(request);
  if (!appUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get('cursor') ?? undefined;
  const limit  = Math.min(parseInt(searchParams.get('limit') ?? '12', 10) || 12, 30);

  try {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
    await prisma.notification.deleteMany({
      where: { userId: appUser.id, createdAt: { lt: cutoff } },
    });

    const notificationsRaw = await prisma.notification.findMany({
      where:   { userId: appUser.id },
      orderBy: { createdAt: 'desc' },
      take:    limit + 1,
      cursor:  cursor ? { id: cursor } : undefined,
      skip:    cursor ? 1 : 0,
      select: { id: true, type: true, title: true, message: true, isRead: true, createdAt: true, videoId: true },
    });

    const hasMore      = notificationsRaw.length > limit;
    const notifications = hasMore ? notificationsRaw.slice(0, limit) : notificationsRaw;
    const nextCursor    = hasMore ? notifications[notifications.length - 1].id : null;

    // Attach each notification's video thumbnail (if any) so the client can show
    // a preview next to star/approval/rejection alerts without a second round-trip.
    const videoIds = [...new Set(notifications.map(n => n.videoId).filter((id): id is string => !!id))];
    const videos = videoIds.length > 0
      ? await prisma.video.findMany({ where: { id: { in: videoIds } }, select: { id: true, thumbnailUrl: true } })
      : [];
    const thumbByVideoId = new Map(videos.map(v => [v.id, v.thumbnailUrl]));
    const notificationsWithThumb = notifications.map(n => ({
      ...n,
      thumbnailUrl: n.videoId ? (thumbByVideoId.get(n.videoId) ?? null) : null,
    }));

    return NextResponse.json({ notifications: notificationsWithThumb, nextCursor, hasMore });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
