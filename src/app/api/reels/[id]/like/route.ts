import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST /api/reels/[id]/like
// Body: { userId: string, userType: "student" | "viewer" | "anonymous" }
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: videoId } = await params;
    const body = await request.json();
    const userId   = (body.userId   ?? '').toString().trim();
    const userType = (body.userType ?? 'anonymous').toString().trim();

    if (!userId) {
      return NextResponse.json({ message: 'userId is required' }, { status: 400 });
    }

    // Check video exists and is public + approved
    const video = await prisma.video.findFirst({
      where: { id: videoId, status: 'APPROVED', isPublic: true },
      select: { id: true, likesCount: true },
    });
    if (!video) {
      return NextResponse.json({ message: 'Video not found' }, { status: 404 });
    }

    // Check if already liked
    const existing = await prisma.like.findUnique({
      where: { videoId_userId: { videoId, userId } },
    });

    if (existing) {
      // Unlike: remove like and decrement count
      await prisma.$transaction([
        prisma.like.delete({ where: { videoId_userId: { videoId, userId } } }),
        prisma.video.update({
          where: { id: videoId },
          data:  { likesCount: { decrement: 1 } },
        }),
      ]);
      const updated = await prisma.video.findUnique({
        where:  { id: videoId },
        select: { likesCount: true },
      });
      return NextResponse.json({ liked: false, likesCount: updated?.likesCount ?? 0 });
    } else {
      // Like: add like and increment count
      await prisma.$transaction([
        prisma.like.create({ data: { videoId, userId, userType } }),
        prisma.video.update({
          where: { id: videoId },
          data:  { likesCount: { increment: 1 } },
        }),
      ]);
      const updated = await prisma.video.findUnique({
        where:  { id: videoId },
        select: { likesCount: true },
      });
      return NextResponse.json({ liked: true, likesCount: updated?.likesCount ?? 0 });
    }
  } catch (error) {
    console.error('POST /api/reels/[id]/like failed:', error);
    return NextResponse.json({ message: 'Failed to toggle like' }, { status: 500 });
  }
}

// GET /api/reels/[id]/like?userId=<id>  — check if user liked this video
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: videoId } = await params;
    const userId = new URL(request.url).searchParams.get('userId') ?? '';

    if (!userId) {
      return NextResponse.json({ liked: false });
    }

    const like = await prisma.like.findUnique({
      where: { videoId_userId: { videoId, userId } },
    });

    const video = await prisma.video.findUnique({
      where:  { id: videoId },
      select: { likesCount: true },
    });

    return NextResponse.json({ liked: !!like, likesCount: video?.likesCount ?? 0 });
  } catch (error) {
    console.error('GET /api/reels/[id]/like failed:', error);
    return NextResponse.json({ message: 'Failed to check like' }, { status: 500 });
  }
}
