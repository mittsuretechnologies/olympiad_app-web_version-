import { NextResponse } from 'next/server';
import { verify } from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { getJwtSecret } from '@/lib/auth-guard';

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

// GET /api/app/users/:userId/following?cursor=<lastFollowId>&limit=20
// Returns the list of AppUsers that :userId follows, one page at a time —
// a popular account can follow thousands of people, so this must stay bounded.
export async function GET(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const appUser = getAppUserFromToken(request);
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { userId } = await params;
  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get('cursor') ?? undefined;
  const limit  = Math.min(parseInt(searchParams.get('limit') ?? '20', 10) || 20, 50);

  try {
    const target = await prisma.appUser.findUnique({
      where: { id: userId },
      select: { id: true, isPrivate: true },
    });
    if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const isOwnProfile = appUser.id === target.id;
    let isFollowing = false;
    if (!isOwnProfile) {
      const viewerFollow = await prisma.follow.findUnique({
        where: { followerId_followingId: { followerId: appUser.id, followingId: target.id } },
      });
      isFollowing = !!viewerFollow;
    }

    const canSeeList = isOwnProfile || !target.isPrivate || isFollowing;
    if (!canSeeList) {
      return NextResponse.json({ error: 'This account is private' }, { status: 403 });
    }

    // Get Follow records where followerId = userId (people this user follows)
    const followsRaw = await prisma.follow.findMany({
      where:   { followerId: userId },
      select:  { id: true, followingId: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take:    limit + 1,
      cursor:  cursor ? { id: cursor } : undefined,
      skip:    cursor ? 1 : 0,
    });

    const hasMore    = followsRaw.length > limit;
    const follows     = hasMore ? followsRaw.slice(0, limit) : followsRaw;
    const nextCursor = hasMore ? follows[follows.length - 1].id : null;

    if (follows.length === 0) return NextResponse.json({ users: [], nextCursor: null, hasMore: false });

    const followingIds = follows.map(f => f.followingId);

    // Fetch the actual user records
    const users = await prisma.appUser.findMany({
      where: { id: { in: followingIds } },
      select: { id: true, userId: true, avatarUrl: true, olympiadId: true },
    });

    // Count how many followers each of these users has — one batched query
    // instead of firing a separate count() per person in the list.
    const followerCountGroups = await prisma.follow.groupBy({
      by: ['followingId'],
      where: { followingId: { in: followingIds } },
      _count: { _all: true },
    });
    const followerCountMap = new Map(followerCountGroups.map(g => [g.followingId, g._count._all]));

    // Which of these does the current viewer follow?
    const myFollows = await prisma.follow.findMany({
      where: { followerId: appUser.id, followingId: { in: followingIds } },
      select: { followingId: true },
    });
    const myFollowSet = new Set(myFollows.map(f => f.followingId));

    // Preserve original order
    const userMap = new Map(users.map(u => [u.id, u]));
    const list = follows
      .map(f => {
        const u = userMap.get(f.followingId);
        if (!u) return null;
        return {
          id:             u.id,
          userId:         u.userId,
          avatarUrl:      u.avatarUrl,
          olympiadId:     u.olympiadId,
          followersCount: followerCountMap.get(u.id) ?? 0,
          isFollowing:    myFollowSet.has(u.id),
          isOwnProfile:   u.id === appUser.id,
        };
      })
      .filter(Boolean);

    return NextResponse.json({ users: list, nextCursor, hasMore });
  } catch (error: any) {
    console.error('following error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
