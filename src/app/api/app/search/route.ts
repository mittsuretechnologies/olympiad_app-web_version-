import { NextResponse } from 'next/server';
import { verify } from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { visibilityWhere } from '@/lib/videoVisibility';
import { getJwtSecret } from '@/lib/jwt-secret';

const JWT_SECRET = getJwtSecret();

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

// Pages of 10 by default; asks the DB for one extra row to learn whether more
// exist, so the app can show "See more people" without a separate count query.
const USERS_PAGE_SIZE = 10;

async function searchUsers(q: string, appUserId: string, offset = 0, pageSize = USERS_PAGE_SIZE) {
  const usersWithExtra = await prisma.appUser.findMany({
    where: {
      isVerified: true,
      deletionRequestedAt: null,
      NOT:        { id: appUserId },
      AND: [
        // Match the handle, or a General School's name.
        { OR: [
          { userId: { contains: q, mode: 'insensitive' } },
          { generalSchool: { name: { contains: q, mode: 'insensitive' } } },
        ] },
        // A school the Super Admin switched off is not discoverable.
        { OR: [{ generalSchool: null }, { generalSchool: { isActive: true } }] },
      ],
    },
    select: {
      id: true, userId: true, avatarUrl: true, olympiadId: true, isPrivate: true, accountType: true,
      generalSchool: { select: { name: true } },
    },
    // Stable order, so paging by offset never repeats or skips someone.
    orderBy: [{ userId: 'asc' }, { id: 'asc' }],
    skip: offset,
    take: pageSize + 1,
  });

  const hasMore = usersWithExtra.length > pageSize;
  const usersRaw = hasMore ? usersWithExtra.slice(0, pageSize) : usersWithExtra;

  const userIds = usersRaw.map(u => u.id);
  if (userIds.length === 0) return { users: [], hasMore: false };

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

  const users = usersRaw.map(u => ({
    id:             u.id,
    userId:         u.userId,
    avatarUrl:      u.avatarUrl,
    olympiadId:     u.olympiadId,
    isPrivate:      u.isPrivate,
    accountType:    u.accountType,
    schoolName:     u.generalSchool?.name ?? null,
    followersCount: followerCountMap.get(u.id)  ?? 0,
    followingCount: followingCountMap.get(u.id) ?? 0,
    isFollowing:    followingSet.has(u.id),
    isPending:      pendingSet.has(u.id),
  }));

  return { users, hasMore };
}

async function searchSchools(q: string, offset = 0, pageSize = USERS_PAGE_SIZE) {
  const withExtra = await prisma.school.findMany({
    where:  { name: { contains: q, mode: 'insensitive' } },
    select: { id: true, schoolId: true, name: true, city: true, state: true },
    // Stable order so paging by offset never repeats or skips a school.
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
    skip: offset,
    take: pageSize + 1,
  });
  const hasMore = withExtra.length > pageSize;
  const schoolsRaw = hasMore ? withExtra.slice(0, pageSize) : withExtra;

  const schoolVideosCounts = await Promise.all(
    schoolsRaw.map(sc =>
      prisma.video.count({
        where: { tags: { contains: sc.schoolId, mode: 'insensitive' }, status: 'APPROVED', isPublic: true },
      })
    )
  );

  return { schools: schoolsRaw.map((sc, i) => ({ ...sc, videoCount: schoolVideosCounts[i] })), hasMore };
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
        student: {
          select: {
            id: true, name: true,
            allocation: { select: { school: { select: { id: true, name: true, state: true, city: true } } } },
          },
        },
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
        select: { id: true, userId: true, avatarUrl: true, olympiadId: true },
      })
    : [];
  const uploaderMap = new Map(uploaders.map(u => [u.id, u]));

  // School can come from either side, same as /api/reels: a Student's own
  // allocation.school, or (for app-registered users) their olympiadId
  // resolved through OlympiadIdAllocation.
  const olympiadCodes = [...new Set(uploaders.map(u => u.olympiadId).filter(Boolean))] as string[];
  const allocationsRaw = olympiadCodes.length > 0
    ? await prisma.olympiadIdAllocation.findMany({
        where:  { code: { in: olympiadCodes } },
        select: { code: true, school: { select: { id: true, name: true, state: true, city: true } } },
      })
    : [];
  const allocationMap = new Map(allocationsRaw.map(a => [a.code, a.school]));

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

  const videos = items.map(v => {
    const uploaderRaw    = v.appUserId ? uploaderMap.get(v.appUserId) : undefined;
    const studentSchool  = v.student?.allocation?.school ?? null;
    const appUserSchool  = uploaderRaw?.olympiadId ? (allocationMap.get(uploaderRaw.olympiadId) ?? null) : null;
    const school         = studentSchool ?? appUserSchool;

    return {
      ...v,
      isLiked:  likedIds.has(v.id),
      uploader: uploaderRaw ?? null,
      student: v.student ? {
        id:         v.student.id,
        name:       v.student.name,
        schoolId:   school?.id   ?? null,
        schoolName: school?.name ?? null,
        state:      school?.state ?? null,
        city:       school?.city  ?? null,
      } : school ? {
        id:         null,
        name:       uploaderRaw?.userId ?? null,
        schoolId:   school.id,
        schoolName: school.name,
        state:      school.state ?? null,
        city:       school.city  ?? null,
      } : null,
    };
  });

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
    return NextResponse.json({ users: [], usersHasMore: false, schools: [], schoolsHasMore: false, videos: [], nextCursor: null, hasMore: false, totalCount: 0 });
  }

  // "See more schools": same, for the Schools section.
  if (searchParams.get('type') === 'schools') {
    try {
      const offset = Math.max(0, parseInt(searchParams.get('offset') ?? '0', 10) || 0);
      const size   = Math.min(parseInt(searchParams.get('limit') ?? '20', 10) || 20, 50);
      const page   = await searchSchools(q, offset, size);
      return NextResponse.json({ schools: page.schools, hasMore: page.hasMore, nextOffset: offset + page.schools.length });
    } catch (error: any) {
      console.error('search schools page error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }

  // "See more people": just the next page of matching users, nothing else.
  if (searchParams.get('type') === 'users') {
    try {
      const offset = Math.max(0, parseInt(searchParams.get('offset') ?? '0', 10) || 0);
      const size   = Math.min(parseInt(searchParams.get('limit') ?? '20', 10) || 20, 50);
      const page   = await searchUsers(q, appUser.id, offset, size);
      return NextResponse.json({ users: page.users, hasMore: page.hasMore, nextOffset: offset + page.users.length });
    } catch (error: any) {
      console.error('search users page error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }

  try {
    // Users / Schools / Videos are independent — run them concurrently
    // instead of paying for each section's latency one after another.
    // Users/schools are only ever fetched on a fresh search (cursor is unset then),
    // so skip re-running them when this call is just paging in more videos.
    const [userPage, schoolPage, videoPage] = await Promise.all([
      cursor ? Promise.resolve({ users: [], hasMore: false }) : searchUsers(q, appUser.id),
      cursor ? Promise.resolve({ schools: [], hasMore: false }) : searchSchools(q),
      searchVideos(q, appUser.id, cursor, limit),
    ]);

    return NextResponse.json({
      users: userPage.users, usersHasMore: userPage.hasMore,
      schools: schoolPage.schools, schoolsHasMore: schoolPage.hasMore,
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
