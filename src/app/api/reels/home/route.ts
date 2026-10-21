import { NextRequest, NextResponse } from 'next/server';
import { verify } from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { visibilityWhere } from '@/lib/videoVisibility';
import { getJwtSecret } from '@/lib/jwt-secret';
import { getLiveTheme } from '@/lib/appTheme';

const JWT_SECRET = getJwtSecret();

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
const OLYMPIAD_ROW_LIMIT = 100;

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
  olympiadVisibility: string | null;
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
  olympiadVisibility: true,
  student: {
    select: {
      id: true,
      name: true,
      allocation: { select: { school: { select: { id: true, name: true, state: true, city: true } } } },
    },
  },
} as const;

// Shape raw rows from multiple queries into the client video format, batching appUser/school lookups once.
// `effectiveUserId` should be the JWT-derived viewerId whenever available — trusting
// the client-supplied query param alone lets isLiked desync from the real Like rows.
async function hydrate(items: RawVideo[], effectiveUserId?: string) {
  // Likes and uploaders don't depend on each other — fetched together.
  const appUserIds = [...new Set(items.map(v => v.appUserId).filter(Boolean))] as string[];
  const [userLikes, appUsersRaw] = await Promise.all([
    effectiveUserId && items.length > 0
      ? prisma.like.findMany({
          where: { userId: effectiveUserId, videoId: { in: [...new Set(items.map(v => v.id))] } },
          select: { videoId: true },
        })
      : Promise.resolve([] as { videoId: string }[]),
    appUserIds.length > 0
      ? prisma.appUser.findMany({
          where: { id: { in: appUserIds } },
          select: { id: true, userId: true, avatarUrl: true, olympiadId: true, schoolRefId: true },
        })
      : Promise.resolve([]),
  ]);
  const likedIds = new Set(userLikes.map(l => l.videoId));
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
      videoUrl: v.videoUrl,
      thumbnailUrl: v.thumbnailUrl,
      caption: v.caption,
      category: v.category,
      subCategory: v.subCategory,
      tags: v.tags,
      likesCount: v.likesCount,
      viewsCount: v.viewsCount,
      createdAt: v.createdAt,
      isLiked: likedIds.has(v.id),
      isEvaluation: v.isEvaluation,
      olympiadVisibility: v.olympiadVisibility,
      appUserId: v.appUserId,
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
      appUser: appUserRaw ? { id: appUserRaw.id, userId: appUserRaw.userId, avatarUrl: appUserRaw.avatarUrl, isOlympiadSchool: !!appUserRaw.schoolRefId } : null,
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
    // Trending feeds the app's hero carousel, so it only takes videos a
    // moderator rated High quality at approval.
    const trendingWhere = { ...baseWhere, quality: 'HIGH' };

    // Admin-managed carousel slides for the app home screen. Independent of
    // visibility/approval rules — they're artwork, not user content — so
    // started now and awaited later, in parallel with the video queries. An
    // empty result is normal and means the app keeps its original behaviour
    // of building the carousel purely from the most-watched videos.
    // All-year slides (themeId null) always; festival slides only while their
    // AppTheme is the live one, and in front of the all-year ones.
    const appBannersPromise = getLiveTheme()
      .catch(() => null)
      .then((live) => {
        const liveId = live?.theme?.id ?? null;
        return prisma.appBannerSlide.findMany({
          where: { isActive: true, OR: [{ themeId: null }, ...(liveId ? [{ themeId: liveId }] : [])] },
          orderBy: { order: 'asc' },
          select: { id: true, image: true, alt: true, title: true, tag: true, linkUrl: true, themeId: true, bgColor: true },
        });
      })
      .then((list) => [...list.filter((b) => b.themeId), ...list.filter((b) => !b.themeId)]
        .map((b) => ({ id: b.id, image: b.image, alt: b.alt, title: b.title, tag: b.tag, linkUrl: b.linkUrl, bgColor: b.bgColor })))
      // Slides are decoration: a failure here must not take the feed down.
      .catch((e) => { console.error('home feed: app banners failed:', e); return []; });

    const [trendingViews, newReleases, categories, mittfest, olympiad] = await Promise.all([
      // Most-viewed High-quality videos based on VideoView rows recorded in the last 7 days.
      prisma.videoView.groupBy({
        by: ['videoId'],
        where: { createdAt: { gte: sevenDaysAgo }, video: { status: 'APPROVED', isPublic: true, quality: 'HIGH' } },
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
      // MittFest — videos whose uploader ticked the MittFest checkbox. Shown
      // to every user (Olympiad or not), directly under the hero carousel.
      prisma.video.findMany({
        take: ROW_LIMIT,
        where: { ...baseWhere, isMittfest: true },
        orderBy: { createdAt: 'desc' },
        select: VIDEO_SELECT,
      }),
      // Olympiad — students' competition uploads (isEvaluation). visibilityWhere
      // already hides private ones from everyone but their owner. A larger cap
      // than other rows: this row is meant to show every Olympiad video.
      prisma.video.findMany({
        take: OLYMPIAD_ROW_LIMIT,
        where: { ...baseWhere, isEvaluation: true },
        orderBy: { createdAt: 'desc' },
        select: VIDEO_SELECT,
      }),
    ]);

    const trendingIds = trendingViews.map(t => t.videoId);
    const categoryNames = categories.map(c => c.category).filter(Boolean) as string[];

    // Second round, all at once: the trending videos (with their fallback),
    // every category row, and the carousel slides.
    const [trendingRaw, categoryRowsRaw, appBanners] = await Promise.all([
      (async () => {
        const found = trendingIds.length > 0
          ? await prisma.video.findMany({
              where: { id: { in: trendingIds }, ...trendingWhere },
              select: VIDEO_SELECT,
            })
          : [];
        // Re-sort to match the view-count ranking (findMany with `in` doesn't preserve order).
        const trendingOrder = new Map(trendingIds.map((id, i) => [id, i]));
        found.sort((a, b) => (trendingOrder.get(a.id) ?? 0) - (trendingOrder.get(b.id) ?? 0));
        if (found.length > 0) return found;
        // Fallback: if no High-quality video has been viewed in 7 days, use all-time viewsCount so the row isn't empty.
        return prisma.video.findMany({
          take: ROW_LIMIT,
          where: trendingWhere,
          orderBy: { viewsCount: 'desc' },
          select: VIDEO_SELECT,
        });
      })(),
      Promise.all(
        categoryNames.map(name =>
          prisma.video.findMany({
            take: ROW_LIMIT,
            where: { ...baseWhere, category: name },
            orderBy: { viewsCount: 'desc' },
            select: VIDEO_SELECT,
          })
        )
      ),
      appBannersPromise,
    ]);

    // One hydrate for every row together — 3 queries in total instead of 3
    // per row — then split back into the rows (a video in several rows is
    // looked up once).
    const effectiveUserId = viewerId ?? userId;
    const rawRows: RawVideo[][] = [trendingRaw, newReleases, mittfest, olympiad, ...categoryRowsRaw];
    const unique = [...new Map(rawRows.flat().map(v => [v.id, v])).values()];
    const hydratedById = new Map((await hydrate(unique, effectiveUserId)).map(v => [v.id, v]));
    const [trending, releases, mittfestVideos, olympiadVideos, ...categoryRows] =
      rawRows.map(row => row.map(v => hydratedById.get(v.id)!));

    // MittFest sits first: the client builds its hero carousel from the
    // 'trending' row (by key, not position) and renders these rows beneath it,
    // so being first here puts MittFest directly under the carousel.
    // Olympiad first of all: the current app renders it directly under the
    // carousel, above MittFest; older app builds show it as their first row.
    const rows = [
      { key: 'olympiad', title: 'Olympiad', videos: olympiadVideos },
      { key: 'mittfest', title: 'MittFest', videos: mittfestVideos },
      { key: 'trending', title: 'Most Watched This Week', videos: trending },
      { key: 'new', title: 'New Releases', videos: releases },
      ...categoryNames.map((name, i) => ({ key: `cat_${i}`, title: name, videos: categoryRows[i] })),
    ].filter(row => row.videos.length > 0);

    // `banners` is additive: older app builds that only read `rows` are
    // unaffected, and a build that does read it treats an empty array as
    // "no admin slides, use videos only".
    return NextResponse.json({ rows, banners: appBanners });
  } catch (error) {
    console.error('GET /api/reels/home failed:', error);
    return NextResponse.json({ message: 'Failed to fetch home feed' }, { status: 500 });
  }
}
