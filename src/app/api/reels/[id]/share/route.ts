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

// POST /api/reels/[id]/share — shares from the authenticated caller
// Body: { recipientUserIds: string[] }
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: videoId } = await params;
    const senderUserId = getAppUserIdFromToken(request);
    const body = await request.json();
    const recipientUserIds: string[] = Array.isArray(body.recipientUserIds)
      ? body.recipientUserIds.map((r: unknown) => String(r).trim()).filter(Boolean)
      : [];

    if (!senderUserId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
    if (!recipientUserIds.length) {
      return NextResponse.json({ message: 'recipientUserIds must be a non-empty array' }, { status: 400 });
    }

    // Verify video exists
    const video = await prisma.video.findFirst({
      where: { id: videoId, status: 'APPROVED', deletedAt: null },
      select: { id: true },
    });
    if (!video) {
      return NextResponse.json({ message: 'Video not found' }, { status: 404 });
    }

    // Verify sender exists
    const sender = await prisma.appUser.findUnique({
      where: { id: senderUserId },
      select: { id: true },
    });
    if (!sender) {
      return NextResponse.json({ message: 'Sender not found' }, { status: 404 });
    }

    // Create one ReelShare row per recipient (skip self-shares)
    const rows = recipientUserIds
      .filter(rid => rid !== senderUserId)
      .map(recipientId => ({ videoId, senderId: senderUserId, recipientId }));

    if (!rows.length) {
      return NextResponse.json({ success: true, shared: 0 });
    }

    await prisma.reelShare.createMany({ data: rows, skipDuplicates: false });

    return NextResponse.json({ success: true, shared: rows.length });
  } catch (error) {
    console.error('POST /api/reels/[id]/share failed:', error);
    return NextResponse.json({ message: 'Failed to share reel' }, { status: 500 });
  }
}
