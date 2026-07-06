import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/reels/inbox/unread-count?userId=<id>
// Lightweight check for the home-screen chat badge — count of shares received but not yet read.
export async function GET(request: NextRequest) {
  try {
    const userId = new URL(request.url).searchParams.get('userId') ?? '';
    if (!userId) {
      return NextResponse.json({ message: 'userId is required' }, { status: 400 });
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
