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
  } catch { return null; }
}

// GET /api/app/videos/:id/likes?cursor=<lastLikeId>&limit=20 — who starred this video (any signed-in app user)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const appUser = getAppUserFromToken(request);
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get('cursor') ?? undefined;
  const limit  = Math.min(parseInt(searchParams.get('limit') ?? '20', 10) || 20, 50);

  try {
    const video = await prisma.video.findFirst({
      where:  { id, deletedAt: null },
      select: { id: true },
    });
    if (!video) return NextResponse.json({ error: 'Video not found' }, { status: 404 });

    const likesRaw = await prisma.like.findMany({
      where:   { videoId: id },
      select:  { id: true, userId: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take:    limit + 1,
      cursor:  cursor ? { id: cursor } : undefined,
      skip:    cursor ? 1 : 0,
    });

    const hasMore    = likesRaw.length > limit;
    const likes       = hasMore ? likesRaw.slice(0, limit) : likesRaw;
    const nextCursor = hasMore ? likes[likes.length - 1].id : null;

    if (likes.length === 0) return NextResponse.json({ users: [], nextCursor: null, hasMore: false });

    const likerIds = likes.map(l => l.userId);
    const likers = await prisma.appUser.findMany({
      where:  { id: { in: likerIds } },
      select: { id: true, userId: true, avatarUrl: true },
    });
    const likerMap = new Map(likers.map(u => [u.id, u]));

    // Preserve like order (most recent first); skip likes whose account was since deleted.
    const list = likes
      .map(l => {
        const u = likerMap.get(l.userId);
        if (!u) return null;
        return { id: u.id, userId: u.userId, avatarUrl: u.avatarUrl };
      })
      .filter(Boolean);

    return NextResponse.json({ users: list, nextCursor, hasMore });
  } catch (error: any) {
    console.error('video likes error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
