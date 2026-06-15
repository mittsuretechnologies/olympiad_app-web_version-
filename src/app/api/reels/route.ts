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
        tags:         true,
        likesCount:   true,
        viewsCount:   true,
        createdAt:    true,
        appUserId:    true,
        isEvaluation: true,
        student: {
          select: {
            id:   true,
            name: true,
            allocation: {
              select: {
                school: {
                  select: { id: true, name: true, state: true, city: true },
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

    // Batch-fetch AppUsers (with olympiadId so we can resolve school)
    const appUserIds = [...new Set(items.map(v => v.appUserId).filter(Boolean))] as string[];
    const appUsersRaw = appUserIds.length > 0
      ? await prisma.appUser.findMany({
          where: { id: { in: appUserIds } },
          select: { id: true, userId: true, avatarUrl: true, olympiadId: true },
        })
      : [];
    const appUserMap = new Map(appUsersRaw.map(u => [u.id, u]));

    // Batch-fetch school info via OlympiadIdAllocation for appUsers who have an olympiadId
    const olympiadCodes = [...new Set(
      appUsersRaw.map(u => u.olympiadId).filter(Boolean)
    )] as string[];
    const allocationsRaw = olympiadCodes.length > 0
      ? await prisma.olympiadIdAllocation.findMany({
          where: { code: { in: olympiadCodes } },
          select: {
            code:   true,
            school: { select: { id: true, name: true, state: true, city: true } },
          },
        })
      : [];
    const allocationMap = new Map(allocationsRaw.map(a => [a.code, a.school]));

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

    const result = items.map(v => {
      const appUserRaw = v.appUserId ? appUserMap.get(v.appUserId) : undefined;

      // Resolve school: prefer student's school, fall back to appUser's olympiadId → school
      const studentSchool = v.student?.allocation?.school ?? null;
      const appUserSchool = appUserRaw?.olympiadId
        ? (allocationMap.get(appUserRaw.olympiadId) ?? null)
        : null;
      const school = studentSchool ?? appUserSchool;

      return {
        id:           v.id,
        videoUrl:     fixUrl(v.videoUrl) ?? v.videoUrl,
        thumbnailUrl: fixUrl(v.thumbnailUrl),
        caption:      v.caption,
        category:     v.category,
        subCategory:  v.subCategory,
        tags:         v.tags,
        likesCount:   v.likesCount,
        viewsCount:   v.viewsCount,
        createdAt:    v.createdAt,
        isLiked:      likedIds.has(v.id),
        isEvaluation: v.isEvaluation,
        student: v.student ? {
          id:         v.student.id,
          name:       v.student.name,
          schoolId:   school?.id   ?? null,
          schoolName: school?.name ?? null,
          state:      school?.state ?? null,
          city:       school?.city  ?? null,
        } : school ? {
          // No student record but school resolved via appUser's olympiadId
          id:         null,
          name:       appUserRaw?.userId ?? null,
          schoolId:   school.id,
          schoolName: school.name,
          state:      school.state ?? null,
          city:       school.city  ?? null,
        } : null,
        appUser: appUserRaw ? {
          id:        appUserRaw.id,
          userId:    appUserRaw.userId,
          avatarUrl: fixUrl(appUserRaw.avatarUrl),
        } : null,
      };
    });

    return NextResponse.json({ videos: result, nextCursor, hasMore });
  } catch (error) {
    console.error('GET /api/reels failed:', error);
    return NextResponse.json({ message: 'Failed to fetch reels' }, { status: 500 });
  }
}
