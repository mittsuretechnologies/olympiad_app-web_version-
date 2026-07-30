import { NextRequest, NextResponse } from 'next/server';
import { verify } from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

function getAppUserIdFromToken(request: Request): string | null {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  try {
    const decoded = verify(token, JWT_SECRET) as any;
    if (decoded.role !== 'APP_USER') return null;
    return decoded.id;
  } catch {
    return null;
  }
}

// GET /api/reels/inbox/conversation?otherId=<id>&cursor=<lastShareId>&limit=20
// Returns reels shared between the authenticated caller and otherId in BOTH directions,
// newest first, one page at a time — a long-running conversation can accumulate a lot
// of shares over time, so this must stay bounded like every other list in the app.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId  = getAppUserIdFromToken(request);
    const otherId = searchParams.get('otherId') ?? '';
    const cursor  = searchParams.get('cursor') ?? undefined;
    const limit   = Math.min(parseInt(searchParams.get('limit') ?? '20', 10) || 20, 50);

    if (!userId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
    if (!otherId) {
      return NextResponse.json({ message: 'otherId is required' }, { status: 400 });
    }

    // Both directions: user→other and other→user
    const sharesRaw = await prisma.reelShare.findMany({
      where: {
        OR: [
          { senderId: userId,  recipientId: otherId },
          { senderId: otherId, recipientId: userId  },
        ],
      },
      orderBy: { sentAt: 'desc' },
      take:    limit + 1,
      cursor:  cursor ? { id: cursor } : undefined,
      skip:    cursor ? 1 : 0,
      include: {
        video: {
          select: {
            id:           true,
            videoUrl:     true,
            thumbnailUrl: true,
            caption:      true,
            category:     true,
            tags:         true,
            viewsCount:   true,
            likesCount:   true,
            isEvaluation: true,
            appUserId:    true,
            studentId:    true,
            student: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    const hasMore    = sharesRaw.length > limit;
    const shares      = hasMore ? sharesRaw.slice(0, limit) : sharesRaw;
    const nextCursor = hasMore ? shares[shares.length - 1].id : null;

    // Fetch appUser details for video creators
    const appUserIds = [...new Set(
      shares.map(s => s.video.appUserId).filter(Boolean) as string[]
    )];
    const appUsers = appUserIds.length
      ? await prisma.appUser.findMany({
          where:  { id: { in: appUserIds } },
          select: { id: true, userId: true, avatarUrl: true },
        })
      : [];
    const appUserMap = new Map(appUsers.map(u => [u.id, u]));

    // This response previously had no isLiked field, so every shared video always
    // rendered as unliked in the conversation player regardless of the real Like row.
    const videoIds = [...new Set(shares.map(s => s.video?.id).filter(Boolean) as string[])];
    const likedIds = videoIds.length > 0
      ? new Set((await prisma.like.findMany({
          where:  { userId, videoId: { in: videoIds } },
          select: { videoId: true },
        })).map(l => l.videoId))
      : new Set<string>();

    const messages = shares.map(s => ({
      id:        s.id,
      sentAt:    s.sentAt.toISOString(),
      direction: s.senderId === userId ? 'sent' : 'received',
      video: s.video
        ? {
            ...s.video,
            isLiked: likedIds.has(s.video.id),
            appUser: s.video.appUserId ? (appUserMap.get(s.video.appUserId) ?? null) : null,
          }
        : null,
    }));

    return NextResponse.json({ messages, nextCursor, hasMore });
  } catch (error) {
    console.error('GET /api/reels/inbox/conversation failed:', error);
    return NextResponse.json({ message: 'Failed to fetch conversation' }, { status: 500 });
  }
}

// PATCH /api/reels/inbox/conversation?otherId=<id>
// Marks all reels otherId sent to the authenticated caller as read (call when the conversation is opened).
export async function PATCH(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId  = getAppUserIdFromToken(request);
    const otherId = searchParams.get('otherId') ?? '';

    if (!userId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
    if (!otherId) {
      return NextResponse.json({ message: 'otherId is required' }, { status: 400 });
    }

    await prisma.reelShare.updateMany({
      where: { senderId: otherId, recipientId: userId, readAt: null },
      data:  { readAt: new Date() },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('PATCH /api/reels/inbox/conversation failed:', error);
    return NextResponse.json({ message: 'Failed to mark conversation read' }, { status: 500 });
  }
}
