import { NextResponse } from 'next/server';
import { verify } from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { visibilityWhere } from '@/lib/videoVisibility';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';
const SERVER_URL  = process.env.SERVER_URL  || 'http://localhost:3000';

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

function normalizeUrl(url: string | null) {
  if (!url) return url;
  return url.replace(/^https?:\/\/[^/]+/, 'http://10.0.2.2:3000');
}

async function searchUsers(q: string, appUserId: string) {
  const usersRaw = await prisma.appUser.findMany({
    where: {
      userId:     { contains: q, mode: 'insensitive' },
      isVerified: true,
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

async function searchVideos(q: string, appUserId: string) {
  const visWhere = await visibilityWhere(appUserId);

  const videosRaw = await prisma.video.findMany({
    where: {
      status:   'APPROVED',
      isPublic: true,
      ...visWhere,
      OR: [
        { caption:     { contains: q, mode: 'insensitive' } },
        { category:    { contains: q, mode: 'insensitive' } },
        { subCategory: { contains: q, mode: 'insensitive' } },
        { tags:        { contains: q, mode: 'insensitive' } },
      ],
    },
    select: {
      id: true, appUserId: true, videoUrl: true, thumbnailUrl: true,
      caption: true, category: true, subCategory: true, tags: true,
      likesCount: true, viewsCount: true, createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take:    30,
  });

  const appUserIds = [...new Set(videosRaw.map(v => v.appUserId).filter(Boolean))] as string[];
  const uploaders = appUserIds.length
    ? await prisma.appUser.findMany({
        where:  { id: { in: appUserIds } },
        select: { id: true, userId: true, avatarUrl: true },
      })
    : [];
  const uploaderMap = new Map(uploaders.map(u => [u.id, u]));

  return videosRaw.map(v => ({
    ...v,
    videoUrl:     normalizeUrl(v.videoUrl),
    thumbnailUrl: normalizeUrl(v.thumbnailUrl),
    uploader:     v.appUserId ? uploaderMap.get(v.appUserId) ?? null : null,
  }));
}

export async function GET(request: Request) {
  const appUser = getAppUserFromToken(request);
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim() || '';

  if (!q || q.length < 1) {
    return NextResponse.json({ users: [], schools: [], videos: [] });
  }

  try {
    // Users / Schools / Videos are independent — run them concurrently
    // instead of paying for each section's latency one after another.
    const [users, schools, videos] = await Promise.all([
      searchUsers(q, appUser.id),
      searchSchools(q),
      searchVideos(q, appUser.id),
    ]);

    return NextResponse.json({ users, schools, videos });
  } catch (error: any) {
    console.error('search error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
