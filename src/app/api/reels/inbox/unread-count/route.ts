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

// GET /api/reels/inbox/unread-count — the authenticated caller's own unread count
// Lightweight check for the home-screen chat badge — count of shares received but not yet read.
export async function GET(request: NextRequest) {
  try {
    const userId = getAppUserIdFromToken(request);
    if (!userId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const unreadCount = await prisma.reelShare.count({
      where: { recipientId: userId, readAt: null },
    });

    return NextResponse.json({ unreadCount });
  } catch (error) {
    console.error('GET /api/reels/inbox/unread-count failed:', error);
    return NextResponse.json({ message: 'Failed to fetch unread count' }, { status: 500 });
  }
}
