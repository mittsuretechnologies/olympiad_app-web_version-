import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST /api/reels/[id]/share
// Body: { senderUserId: string, recipientUserIds: string[] }
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: videoId } = await params;
    const body = await request.json();
    const senderUserId: string = (body.senderUserId ?? '').toString().trim();
    const recipientUserIds: string[] = Array.isArray(body.recipientUserIds)
      ? body.recipientUserIds.map((r: unknown) => String(r).trim()).filter(Boolean)
      : [];

    if (!senderUserId) {
      return NextResponse.json({ message: 'senderUserId is required' }, { status: 400 });
    }
    if (!recipientUserIds.length) {
      return NextResponse.json({ message: 'recipientUserIds must be a non-empty array' }, { status: 400 });
    }

    // Verify video exists
    const video = await prisma.video.findFirst({
      where: { id: videoId, status: 'APPROVED' },
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
