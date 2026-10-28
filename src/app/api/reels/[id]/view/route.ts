import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAppUser } from '@/lib/coins/appAuth';
import { recordCoinEvent } from '@/lib/coins/tasks';

// POST /api/reels/[id]/view
// Body: { sessionId: string }  — every play is counted, repeats included
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

    // Every play counts — including the same person watching the same video
    // again. (This used to skip a view if the same session had one in the last
    // 15 minutes; that cooldown was removed on purpose.)
    await prisma.$transaction([
      prisma.videoView.create({ data: { videoId, sessionId } }),
      prisma.video.update({
        where: { id: videoId },
        data:  { viewsCount: { increment: 1 } },
      }),
    ]);

    // Views are anonymous, but a signed-in viewer's watch counts towards a
    // "watch videos" coin task (signature check only, no extra query).
    const viewer = requireAppUser(request);
    if (viewer.userId) void recordCoinEvent(viewer.userId, 'WATCH_VIDEO').catch(() => {});

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
