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

// GET /api/reels/inbox/conversation?otherId=<id>
// Returns all reels shared between the authenticated caller and otherId in BOTH directions, newest first.
export async function GET(request: NextRequest) {
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

    // Both directions: user→other and other→user
    const shares = await prisma.reelShare.findMany({
      where: {
        OR: [
          { senderId: userId,  recipientId: otherId },
          { senderId: otherId, recipientId: userId  },
        ],
      },
      orderBy: { sentAt: 'desc' },
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

    const messages = shares.map(s => ({
      id:        s.id,
      sentAt:    s.sentAt.toISOString(),
      direction: s.senderId === userId ? 'sent' : 'received',
      video: s.video
        ? {
            ...s.video,
            videoUrl:     fixUrl(s.video.videoUrl),
            thumbnailUrl: fixUrl(s.video.thumbnailUrl),
            appUser: s.video.appUserId ? (appUserMap.get(s.video.appUserId) ?? null) : null,
          }
        : null,
    }));

    return NextResponse.json({ messages });
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
