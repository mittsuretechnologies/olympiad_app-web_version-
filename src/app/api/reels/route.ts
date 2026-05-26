import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/reels?cursor=<lastVideoId>&limit=10&category=dance&userId=<id>
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const cursor   = searchParams.get('cursor')   ?? undefined;
    const limit    = Math.min(parseInt(searchParams.get('limit') ?? '10'), 20);
    const category = searchParams.get('category') ?? undefined;
    const userId   = searchParams.get('userId')   ?? undefined;

    const where: any = {
      status:   'APPROVED',
      isPublic: true,
    };
    if (category) where.category = { equals: category, mode: 'insensitive' };

    const videos = await prisma.video.findMany({
      take:    limit + 1,
      cursor:  cursor ? { id: cursor } : undefined,
      skip:    cursor ? 1 : 0,
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id:           true,
        videoUrl:     true,
        thumbnailUrl: true,
        caption:      true,
        category:     true,
        subCategory:  true,
        likesCount:   true,
        viewsCount:   true,
        createdAt:    true,
        student: {
          select: {
            id:   true,
            name: true,
            allocation: {
              select: {
                school: {
                  select: { name: true, state: true, city: true },
                },
              },
            },
          },
        },
      },
    });

    const hasMore = videos.length > limit;
    const items   = hasMore ? videos.slice(0, limit) : videos;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    // If userId provided, check which videos this user has liked
    let likedIds: Set<string> = new Set();
    if (userId && items.length > 0) {
      const videoIds = items.map(v => v.id);
      const userLikes = await prisma.like.findMany({
        where: { userId, videoId: { in: videoIds } },
        select: { videoId: true },
      });
      likedIds = new Set(userLikes.map(l => l.videoId));
    }

    const serverUrl = process.env.SERVER_URL || 'http://localhost:3000';

    // Rewrite the host:port of any stored URL to the current SERVER_URL so devices can stream them.
    // Handles localhost, 0.0.0.0, or any old LAN IP that may have changed.
    const fixUrl = (url: string | null) => {
      if (!url) return null;
      try {
        const parsed = new URL(url);
        const target = new URL(serverUrl);
        parsed.protocol = target.protocol;
        parsed.hostname = target.hostname;
        parsed.port     = target.port;
        return parsed.toString();
      } catch {
        return url;
      }
    };

    const result = items.map(v => ({
      id:           v.id,
      videoUrl:     fixUrl(v.videoUrl) ?? v.videoUrl,
      thumbnailUrl: fixUrl(v.thumbnailUrl),
      caption:      v.caption,
      category:     v.category,
      subCategory:  v.subCategory,
      likesCount:   v.likesCount,
      viewsCount:   v.viewsCount,
      createdAt:    v.createdAt,
      isLiked:      likedIds.has(v.id),
      student: {
        id:         v.student.id,
        name:       v.student.name,
        schoolName: v.student.allocation?.school?.name ?? null,
        state:      v.student.allocation?.school?.state ?? null,
        city:       v.student.allocation?.school?.city ?? null,
      },
    }));

    return NextResponse.json({ videos: result, nextCursor, hasMore });
  } catch (error) {
    console.error('GET /api/reels failed:', error);
    return NextResponse.json({ message: 'Failed to fetch reels' }, { status: 500 });
  }
}
