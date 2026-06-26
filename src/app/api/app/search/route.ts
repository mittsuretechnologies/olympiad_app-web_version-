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

export async function GET(request: Request) {
  const appUser = getAppUserFromToken(request);
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim() || '';

  if (!q || q.length < 1) {
    return NextResponse.json({ users: [], schools: [], videos: [] });
  }

  try {
    // ── Users ──────────────────────────────────────────────────────────────────
    const usersRaw = await prisma.appUser.findMany({
      where: {
        userId:     { contains: q, mode: 'insensitive' },
        isVerified: true,
        NOT:        { id: appUser.id },
      },
      select: { id: true, userId: true, avatarUrl: true, olympiadId: true, isPrivate: true },
      take: 10,
    });

    const userIds = usersRaw.map(u => u.id);

    const [followerCounts, followingCounts, existingFollows, pendingRequests] = await Promise.all([
      Promise.all(userIds.map(id => prisma.follow.count({ where: { followingId: id } }))),
      Promise.all(userIds.map(id => prisma.follow.count({ where: { followerId:  id } }))),
      prisma.follow.findMany({
        where:  { followerId: appUser.id, followingId: { in: userIds } },
        select: { followingId: true },
      }),
      prisma.followRequest.findMany({
        where:  { senderId: appUser.id, receiverId: { in: userIds }, status: 'PENDING' },
        select: { receiverId: true },
      }),
    ]);

    const followerCountMap  = new Map(userIds.map((id, i) => [id, followerCounts[i]]));
    const followingCountMap = new Map(userIds.map((id, i) => [id, followingCounts[i]]));
    const followingSet      = new Set(existingFollows.map(f => f.followingId));
    const pendingSet        = new Set(pendingRequests.map(r => r.receiverId));

    const users = usersRaw.map(u => ({
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

    // ── Schools ────────────────────────────────────────────────────────────────
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

    const schools = schoolsRaw.map((sc, i) => ({ ...sc, videoCount: schoolVideosCounts[i] }));

    // ── Videos ─────────────────────────────────────────────────────────────────
    // Apply profile-privacy visibility filter
    const visWhere = await visibilityWhere(appUser.id);

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
    const uploaders  = await prisma.appUser.findMany({
      where:  { id: { in: appUserIds } },
      select: { id: true, userId: true, avatarUrl: true },
    });
    const uploaderMap = new Map(uploaders.map(u => [u.id, u]));

    const videos = videosRaw.map(v => ({
      ...v,
      videoUrl:     normalizeUrl(v.videoUrl),
      thumbnailUrl: normalizeUrl(v.thumbnailUrl),
      uploader:     v.appUserId ? uploaderMap.get(v.appUserId) ?? null : null,
    }));

    return NextResponse.json({ users, schools, videos });
  } catch (error: any) {
    console.error('search error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
