import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/reels/inbox?userId=<id>
// Returns all conversations the user is part of (sent OR received),
// one entry per "other person", sorted by most recent activity.
export async function GET(request: NextRequest) {
  try {
    const userId = new URL(request.url).searchParams.get('userId') ?? '';
    if (!userId) {
      return NextResponse.json({ message: 'userId is required' }, { status: 400 });
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

    return NextResponse.json({ conversations });
  } catch (error) {
    console.error('GET /api/reels/inbox failed:', error);
    return NextResponse.json({ message: 'Failed to fetch inbox' }, { status: 500 });
  }
}
