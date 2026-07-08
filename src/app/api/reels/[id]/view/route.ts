import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST /api/reels/[id]/view
// Body: { sessionId: string }  — deduplicated per session per 15 min window
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: videoId } = await params;
    const body      = await request.json();
    const sessionId = (body.sessionId ?? '').toString().trim();

    if (!sessionId) {
      return NextResponse.json({ message: 'sessionId is required' }, { status: 400 });
    }

    // Check video exists
    const video = await prisma.video.findFirst({
      where:  { id: videoId, status: 'APPROVED', isPublic: true, deletedAt: null },
      select: { id: true },
    });
    if (!video) {
      return NextResponse.json({ message: 'Video not found' }, { status: 404 });
    }

    // Deduplicate: only count a view if this session hasn't viewed in last 15 min
    const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);
    const recentView = await prisma.videoView.findFirst({
      where: {
        videoId,
        sessionId,
        createdAt: { gte: fifteenMinsAgo },
      },
    });

    if (!recentView) {
      await prisma.$transaction([
        prisma.videoView.create({ data: { videoId, sessionId } }),
        prisma.video.update({
          where: { id: videoId },
          data:  { viewsCount: { increment: 1 } },
        }),
      ]);
    }

    const updated = await prisma.video.findUnique({
      where:  { id: videoId },
      select: { viewsCount: true },
    });

    return NextResponse.json({ viewsCount: updated?.viewsCount ?? 0 });
  } catch (error) {
    console.error('POST /api/reels/[id]/view failed:', error);
    return NextResponse.json({ message: 'Failed to record view' }, { status: 500 });
  }
}
