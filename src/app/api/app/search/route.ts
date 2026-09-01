import { NextResponse } from 'next/server';
import { verify } from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { visibilityWhere } from '@/lib/videoVisibility';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

function getAppUserFromToken(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  try {
    const decoded = verify(token, JWT_SECRET) as any;
    if (decoded.role !== 'APP_USER') return null;
    return decoded;
  } catch { return null; }
}

async function searchUsers(q: string, appUserId: string) {
  const usersRaw = await prisma.appUser.findMany({
    where: {
      userId:     { contains: q, mode: 'insensitive' },
      isVerified: true,
      deletionRequestedAt: null,
      NOT:        { id: appUserId },
    },
    select: { id: true, userId: true, avatarUrl: true, olympiadId: true, isPrivate: true },
    take: 10,
  });

  const userIds = usersRaw.map(u => u.id);
  if (userIds.length === 0) return [];

  // Batched aggregates instead of firing 2 count() queries per matched user.
  const [followerGroups, followingGroups, existingFollows, pendingRequests] = await Promise.all([
    prisma.follow.groupBy({ by: ['followingId'], where: { followingId: { in: userIds } }, _count: { _all: true } }),
    prisma.follow.groupBy({ by: ['followerId'],  where: { followerId:  { in: userIds } }, _count: { _all: true } }),
    prisma.follow.findMany({
      where:  { followerId: appUserId, followingId: { in: userIds } },
      select: { followingId: true },
    }),
    prisma.followRequest.findMany({
      where:  { senderId: appUserId, receiverId: { in: userIds }, status: 'PENDING' },
      select: { receiverId: true },
    }),
  ]);

  const followerCountMap  = new Map(followerGroups.map(g => [g.followingId, g._count._all]));
  const followingCountMap = new Map(followingGroups.map(g => [g.followerId, g._count._all]));
  const followingSet      = new Set(existingFollows.map(f => f.followingId));
  const pendingSet        = new Set(pendingRequests.map(r => r.receiverId));

  return usersRaw.map(u => ({
    id:             u.id,
    userId:         u.userId,
    avatarUrl:      u.avatarUrl,
    olympiadId:     u.olympiadId,
    isPrivate:      u.isPrivate,
    followersCount: followerCountMap.get(u.id)  ?? 0,
    followingCount: followingCountMap.get(u.id) ?? 0,
    isFollowing:    followingSet.has(u.id),
    isPending:      pendingSet.has(u.id),
  }));
}

async function searchSchools(q: string) {
  const schoolsRaw = await prisma.school.findMany({
    where:  { name: { contains: q, mode: 'insensitive' } },
    select: { id: true, schoolId: true, name: true, city: true, state: true },
    take:   10,
  });

  const schoolVideosCounts = await Promise.all(
    schoolsRaw.map(sc =>
      prisma.video.count({
        where: { tags: { contains: sc.schoolId, mode: 'insensitive' }, status: 'APPROVED', isPublic: true },
      })
    )
  );

  return schoolsRaw.map((sc, i) => ({ ...sc, videoCount: schoolVideosCounts[i] }));
}

async function searchVideos(q: string, appUserId: string, cursor: string | undefined, limit: number) {
  const visWhere = await visibilityWhere(appUserId);

  const where = {
    status:   'APPROVED' as const,
    isPublic: true,
    ...visWhere,
    OR: [
      { caption:     { contains: q, mode: 'insensitive' as const } },
      { category:    { contains: q, mode: 'insensitive' as const } },
      { subCategory: { contains: q, mode: 'insensitive' as const } },
      { tags:        { contains: q, mode: 'insensitive' as const } },
    ],
  };

  // Total only needs to be known once — the client captures it on the first page
  // and keeps displaying it unchanged while paginating, so skip the count query
  // entirely on "load more" requests.
  const [videosRaw, totalCount] = await Promise.all([
    prisma.video.findMany({
      where,
      select: {
        id: true, appUserId: true, videoUrl: true, thumbnailUrl: true,
        caption: true, category: true, subCategory: true, tags: true,
        likesCount: true, viewsCount: true, createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take:    limit + 1,
      cursor:  cursor ? { id: cursor } : undefined,
      skip:    cursor ? 1 : 0,
    }),
    cursor ? Promise.resolve(null) : prisma.video.count({ where }),
  ]);

  const hasMore    = videosRaw.length > limit;
  const items      = hasMore ? videosRaw.slice(0, limit) : videosRaw;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  const appUserIds = [...new Set(items.map(v => v.appUserId).filter(Boolean))] as string[];
  const uploaders = appUserIds.length
    ? await prisma.appUser.findMany({
        where:  { id: { in: appUserIds } },
        select: { id: true, userId: true, avatarUrl: true },
      })
    : [];
  const uploaderMap = new Map(uploaders.map(u => [u.id, u]));

  // This response previously had no isLiked field, so every video from search
  // results always rendered as unliked regardless of the real Like row.
  let likedIds: Set<string> = new Set();
  if (items.length > 0) {
    const userLikes = await prisma.like.findMany({
      where: { userId: appUserId, videoId: { in: items.map(v => v.id) } },
      select: { videoId: true },
    });
    likedIds = new Set(userLikes.map(l => l.videoId));
  }

  const videos = items.map(v => ({
    ...v,
    isLiked:  likedIds.has(v.id),
    uploader: v.appUserId ? uploaderMap.get(v.appUserId) ?? null : null,
  }));

  return { videos, nextCursor, hasMore, totalCount };
}

export async function GET(request: Request) {
  const appUser = getAppUserFromToken(request);
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q      = searchParams.get('q')?.trim() || '';
  const cursor = searchParams.get('cursor') ?? undefined;
  const limit  = Math.min(parseInt(searchParams.get('limit') ?? '12', 10) || 12, 30);

  if (!q || q.length < 1) {
    return NextResponse.json({ users: [], schools: [], videos: [], nextCursor: null, hasMore: false, totalCount: 0 });
  }

  try {
    // Users / Schools / Videos are independent — run them concurrently
    // instead of paying for each section's latency one after another.
    // Users/schools are only ever fetched on a fresh search (cursor is unset then),
    // so skip re-running them when this call is just paging in more videos.
    const [users, schools, videoPage] = await Promise.all([
      cursor ? Promise.resolve([]) : searchUsers(q, appUser.id),
      cursor ? Promise.resolve([]) : searchSchools(q),
      searchVideos(q, appUser.id, cursor, limit),
    ]);

    return NextResponse.json({
      users, schools,
      videos:     videoPage.videos,
      nextCursor: videoPage.nextCursor,
      hasMore:    videoPage.hasMore,
      totalCount: videoPage.totalCount,
    });
  } catch (error: any) {
    console.error('search error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
