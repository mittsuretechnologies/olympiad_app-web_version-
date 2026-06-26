import { NextRequest, NextResponse } from 'next/server';
import { verify } from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { visibilityWhere } from '@/lib/videoVisibility';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

function getViewerIdFromToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  try {
    const decoded = verify(token, JWT_SECRET) as any;
    return decoded.role === 'APP_USER' ? decoded.id : null;
  } catch { return null; }
}

const ROW_LIMIT = 15;

function fixUrlFactory() {
  const serverUrl = process.env.SERVER_URL || 'http://localhost:3000';
  return (url: string | null) => {
    if (!url) return null;
    try {
      const parsed = new URL(url);
      const target = new URL(serverUrl);
      parsed.protocol = target.protocol;
      parsed.hostname = target.hostname;
      parsed.port = target.port;
      return parsed.toString();
    } catch {
      return url;
    }
  };
}

type RawVideo = {
  id: string;
  videoUrl: string;
  thumbnailUrl: string | null;
  caption: string | null;
  category: string | null;
  subCategory: string | null;
  tags: string | null;
  likesCount: number;
  viewsCount: number;
  createdAt: Date;
  appUserId: string | null;
  isEvaluation: boolean;
  student: {
    id: string;
    name: string;
    allocation: { school: { id: string; name: string; state: string | null; city: string | null } | null } | null;
  } | null;
};

const VIDEO_SELECT = {
  id: true,
  videoUrl: true,
  thumbnailUrl: true,
  caption: true,
  category: true,
  subCategory: true,
  tags: true,
  likesCount: true,
  viewsCount: true,
  createdAt: true,
  appUserId: true,
  isEvaluation: true,
  student: {
    select: {
      id: true,
      name: true,
      allocation: { select: { school: { select: { id: true, name: true, state: true, city: true } } } },
    },
  },
} as const;

// Shape raw rows from multiple queries into the client video format, batching appUser/school lookups once.
async function hydrate(items: RawVideo[], userId?: string) {
  const fixUrl = fixUrlFactory();

  let likedIds: Set<string> = new Set();
  if (userId && items.length > 0) {
    const userLikes = await prisma.like.findMany({
      where: { userId, videoId: { in: items.map(v => v.id) } },
      select: { videoId: true },
    });
    likedIds = new Set(userLikes.map(l => l.videoId));
  }

  const appUserIds = [...new Set(items.map(v => v.appUserId).filter(Boolean))] as string[];
  const appUsersRaw = appUserIds.length > 0
    ? await prisma.appUser.findMany({
        where: { id: { in: appUserIds } },
        select: { id: true, userId: true, avatarUrl: true, olympiadId: true },
      })
    : [];
  const appUserMap = new Map(appUsersRaw.map(u => [u.id, u]));

  const olympiadCodes = [...new Set(appUsersRaw.map(u => u.olympiadId).filter(Boolean))] as string[];
  const allocationsRaw = olympiadCodes.length > 0
    ? await prisma.olympiadIdAllocation.findMany({
        where: { code: { in: olympiadCodes } },
        select: { code: true, school: { select: { id: true, name: true, state: true, city: true } } },
      })
    : [];
  const allocationMap = new Map(allocationsRaw.map(a => [a.code, a.school]));

  return items.map(v => {
    const appUserRaw = v.appUserId ? appUserMap.get(v.appUserId) : undefined;
    const studentSchool = v.student?.allocation?.school ?? null;
    const appUserSchool = appUserRaw?.olympiadId ? (allocationMap.get(appUserRaw.olympiadId) ?? null) : null;
    const school = studentSchool ?? appUserSchool;

    return {
      id: v.id,
      videoUrl: fixUrl(v.videoUrl) ?? v.videoUrl,
      thumbnailUrl: fixUrl(v.thumbnailUrl),
      caption: v.caption,
      category: v.category,
      subCategory: v.subCategory,
      tags: v.tags,
      likesCount: v.likesCount,
      viewsCount: v.viewsCount,
      createdAt: v.createdAt,
      isLiked: likedIds.has(v.id),
      isEvaluation: v.isEvaluation,
      student: v.student
        ? {
            id: v.student.id,
            name: v.student.name,
            schoolId: school?.id ?? null,
            schoolName: school?.name ?? null,
            state: school?.state ?? null,
            city: school?.city ?? null,
          }
        : school
        ? { id: null, name: appUserRaw?.userId ?? null, schoolId: school.id, schoolName: school.name, state: school.state ?? null, city: school.city ?? null }
        : null,
      appUser: appUserRaw ? { id: appUserRaw.id, userId: appUserRaw.userId, avatarUrl: fixUrl(appUserRaw.avatarUrl) } : null,
    };
  });
}

// GET /api/reels/home?userId=<id>
// Returns Netflix-style rows: Trending (most viewed in last 7 days), New Releases, then one row per active category.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId   = searchParams.get('userId') ?? undefined;
    const viewerId = getViewerIdFromToken(request);

    const visWhere = await visibilityWhere(viewerId ?? null);
    const baseWhere = { status: 'APPROVED', isPublic: true, ...visWhere } as const;

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [trendingViews, newReleases, categories] = await Promise.all([
      // Most-viewed videos based on VideoView rows recorded in the last 7 days.
      prisma.videoView.groupBy({
        by: ['videoId'],
        where: { createdAt: { gte: sevenDaysAgo } },
        _count: { videoId: true },
        orderBy: { _count: { videoId: 'desc' } },
        take: ROW_LIMIT,
      }),
      prisma.video.findMany({
        take: ROW_LIMIT,
        where: baseWhere,
        orderBy: { createdAt: 'desc' },
        select: VIDEO_SELECT,
      }),
      prisma.video.findMany({
        where: { ...baseWhere, category: { not: null } },
        select: { category: true },
        distinct: ['category'],
      }),
    ]);

    const trendingIds = trendingViews.map(t => t.videoId);
    const trendingVideosRaw = trendingIds.length > 0
      ? await prisma.video.findMany({
          where: { id: { in: trendingIds }, ...baseWhere },
          select: VIDEO_SELECT,
        })
      : [];
    // Re-sort to match the view-count ranking (findMany with `in` doesn't preserve order).
    const trendingOrder = new Map(trendingIds.map((id, i) => [id, i]));
    trendingVideosRaw.sort((a, b) => (trendingOrder.get(a.id) ?? 0) - (trendingOrder.get(b.id) ?? 0));

    // Fallback: if nothing has been viewed in 7 days yet, use all-time viewsCount so the row isn't empty.
    let trendingRaw = trendingVideosRaw;
    if (trendingRaw.length === 0) {
      trendingRaw = await prisma.video.findMany({
        take: ROW_LIMIT,
        where: baseWhere,
        orderBy: { viewsCount: 'desc' },
        select: VIDEO_SELECT,
      });
    }

    const categoryNames = categories.map(c => c.category).filter(Boolean) as string[];
    const categoryRowsRaw = await Promise.all(
      categoryNames.map(name =>
        prisma.video.findMany({
          take: ROW_LIMIT,
          where: { ...baseWhere, category: name },
          orderBy: { viewsCount: 'desc' },
          select: VIDEO_SELECT,
        })
      )
    );

    const [trending, releases, ...categoryRows] = await Promise.all([
      hydrate(trendingRaw, userId),
      hydrate(newReleases, userId),
      ...categoryRowsRaw.map(rows => hydrate(rows, userId)),
    ]);

    const rows = [
      { key: 'trending', title: 'Most Watched This Week', videos: trending },
      { key: 'new', title: 'New Releases', videos: releases },
      ...categoryNames.map((name, i) => ({ key: `cat_${i}`, title: name, videos: categoryRows[i] })),
    ].filter(row => row.videos.length > 0);

    return NextResponse.json({ rows });
  } catch (error) {
    console.error('GET /api/reels/home failed:', error);
    return NextResponse.json({ message: 'Failed to fetch home feed' }, { status: 500 });
  }
}
