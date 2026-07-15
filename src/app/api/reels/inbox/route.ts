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

// GET /api/reels/inbox — the authenticated caller's own inbox
// Returns all conversations the user is part of (sent OR received),
// one entry per "other person", sorted by most recent activity.
export async function GET(request: NextRequest) {
  try {
    const userId = getAppUserIdFromToken(request);
    if (!userId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    // Fetch all shares where user is sender OR recipient
    const shares = await prisma.reelShare.findMany({
      where: {
        OR: [{ senderId: userId }, { recipientId: userId }],
      },
      orderBy: { sentAt: 'desc' },
      include: {
        sender:    { select: { id: true, userId: true, avatarUrl: true } },
        recipient: { select: { id: true, userId: true, avatarUrl: true } },
        video:     { select: { id: true, thumbnailUrl: true, caption: true } },
      },
    });

    // Group by "other person" — keep only the latest share per pair
    const seen = new Map<string, typeof shares[0]>();
    for (const s of shares) {
      const otherId = s.senderId === userId ? s.recipientId : s.senderId;
      if (!seen.has(otherId)) seen.set(otherId, s);
    }

    // Any unread (received, not yet read) share per "other person" marks that conversation unread.
    const unreadOtherIds = new Set(
      shares.filter(s => s.recipientId === userId && !s.readAt).map(s => s.senderId)
    );

    const conversations = [...seen.entries()].map(([otherId, s]) => {
      const isSent      = s.senderId === userId;
      const otherUser   = isSent ? s.recipient : s.sender;
      return {
        otherId:         otherId,
        otherName:       otherUser.userId,
        otherAvatar:     otherUser.avatarUrl ?? null,
        lastReelThumb:   s.video.thumbnailUrl ?? null,
        lastReelCaption: s.video.caption ?? null,
        sentAt:          s.sentAt.toISOString(),
        direction:       isSent ? 'sent' : 'received',   // for UI label
        hasUnread:       unreadOtherIds.has(otherId),
      };
    });

    const serverUrl = process.env.SERVER_URL || 'http://localhost:3000';
    const fixUrl = (url: string | null) => {
      if (!url) return null;
      try {
        const parsed = new URL(url);
        const target = new URL(serverUrl);
        parsed.protocol = target.protocol;
        parsed.hostname = target.hostname;
        parsed.port     = target.port;
        return parsed.toString();
      } catch { return url; }
    };

    conversations.forEach(c => { c.lastReelThumb = fixUrl(c.lastReelThumb); });

    // Sort by sentAt descending
    conversations.sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());

    const unreadCount = conversations.filter(c => c.hasUnread).length;

    return NextResponse.json({ conversations, unreadCount });
  } catch (error) {
    console.error('GET /api/reels/inbox failed:', error);
    return NextResponse.json({ message: 'Failed to fetch inbox' }, { status: 500 });
  }
}
