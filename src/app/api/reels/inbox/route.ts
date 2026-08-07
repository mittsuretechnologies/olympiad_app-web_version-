import { NextRequest, NextResponse } from 'next/server';
import { verify } from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { getJwtSecret } from '@/lib/auth-guard';

const JWT_SECRET = getJwtSecret();

function getAppUserIdFromToken(request: Request): string | null {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  try {
    const decoded = verify(token, JWT_SECRET) as any;
    return decoded.role === 'APP_USER' ? decoded.id : null;
  } catch {
    return null;
  }
}

// GET /api/reels/inbox?cursor=<offset>&limit=15 — the authenticated caller's own inbox
// Returns one entry per "other person" (conversation partner), most recent activity first,
// one page at a time.
//
// This can't use simple id-based cursor pagination like the other list endpoints, because
// the response is derived — one row per counterpart, not one row per ReelShare. Instead:
// 1. Two groupBy queries find each conversation partner's most recent share timestamp.
//    These are bounded by how many distinct people the user has ever shared reels with,
//    NOT by total historical share count — so this stays cheap even for a very active
//    sharer with thousands of shares across a modest number of conversations.
// 2. That small partner list is sorted/paginated in memory (offset-based cursor).
// 3. Only the current page's ~15 partners get a full detail lookup (thumbnail/caption/etc).
export async function GET(request: NextRequest) {
  try {
    const userId = getAppUserIdFromToken(request);
    if (!userId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const cursor = Math.max(parseInt(searchParams.get('cursor') ?? '0', 10) || 0, 0);
    const limit  = Math.min(parseInt(searchParams.get('limit') ?? '15', 10) || 15, 30);

    const [sentGroups, receivedGroups, allUnreadSenders] = await Promise.all([
      prisma.reelShare.groupBy({ by: ['recipientId'], where: { senderId: userId }, _max: { sentAt: true } }),
      prisma.reelShare.groupBy({ by: ['senderId'],    where: { recipientId: userId }, _max: { sentAt: true } }),
      prisma.reelShare.findMany({
        where:    { recipientId: userId, readAt: null },
        select:   { senderId: true },
        distinct: ['senderId'],
      }),
    ]);

    const latestByOther = new Map<string, Date>();
    for (const g of sentGroups) {
      if (g._max.sentAt) latestByOther.set(g.recipientId, g._max.sentAt);
    }
    for (const g of receivedGroups) {
      if (!g._max.sentAt) continue;
      const prev = latestByOther.get(g.senderId);
      if (!prev || g._max.sentAt > prev) latestByOther.set(g.senderId, g._max.sentAt);
    }

    const orderedOtherIds = [...latestByOther.entries()]
      .sort((a, b) => b[1].getTime() - a[1].getTime())
      .map(([id]) => id);

    const totalCount = orderedOtherIds.length;
    const pageIds    = orderedOtherIds.slice(cursor, cursor + limit);
    const hasMore    = cursor + limit < totalCount;
    const nextCursor = hasMore ? cursor + limit : null;
    const unreadCount = allUnreadSenders.length;

    if (pageIds.length === 0) {
      return NextResponse.json({ conversations: [], nextCursor: null, hasMore: false, unreadCount });
    }

    // Detail lookup — only for this page's conversation partners.
    const shares = await prisma.reelShare.findMany({
      where: {
        OR: pageIds.flatMap(otherId => [
          { senderId: userId, recipientId: otherId },
          { senderId: otherId, recipientId: userId },
        ]),
      },
      orderBy: { sentAt: 'desc' },
      include: {
        sender:    { select: { id: true, userId: true, avatarUrl: true } },
        recipient: { select: { id: true, userId: true, avatarUrl: true } },
        video:     { select: { id: true, thumbnailUrl: true, caption: true } },
      },
    });

    const latestSharePerOther = new Map<string, typeof shares[0]>();
    for (const s of shares) {
      const otherId = s.senderId === userId ? s.recipientId : s.senderId;
      if (!latestSharePerOther.has(otherId)) latestSharePerOther.set(otherId, s);
    }

    const unreadSet = new Set(allUnreadSenders.map(u => u.senderId));

    const conversations = pageIds
      .map(otherId => {
        const s = latestSharePerOther.get(otherId);
        if (!s) return null;
        const isSent    = s.senderId === userId;
        const otherUser = isSent ? s.recipient : s.sender;
        return {
          otherId,
          otherName:       otherUser.userId,
          otherAvatar:     otherUser.avatarUrl ?? null,
          lastReelThumb:   s.video.thumbnailUrl ?? null,
          lastReelCaption: s.video.caption ?? null,
          sentAt:          s.sentAt.toISOString(),
          direction:       isSent ? 'sent' : 'received',
          hasUnread:       unreadSet.has(otherId),
        };
      })
      .filter(Boolean);

    return NextResponse.json({ conversations, nextCursor, hasMore, unreadCount });
  } catch (error) {
    console.error('GET /api/reels/inbox failed:', error);
    return NextResponse.json({ message: 'Failed to fetch inbox' }, { status: 500 });
  }
}
