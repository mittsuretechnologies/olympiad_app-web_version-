import { NextResponse } from 'next/server';
import { verify } from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';

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

// GET /api/app/users/:userId/followers
// Returns the list of AppUsers who follow :userId
export async function GET(request: Request, { params }: { params: { userId: string } }) {
  const appUser = getAppUserFromToken(request);
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { userId } = params;

  try {
    // Get Follow records where followingId = userId (people who follow this user)
    const follows = await prisma.follow.findMany({
      where: { followingId: userId },
      select: { followerId: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });

    if (follows.length === 0) return NextResponse.json([]);

    const followerIds = follows.map(f => f.followerId);

    // Fetch the actual user records
    const users = await prisma.appUser.findMany({
      where: { id: { in: followerIds } },
      select: { id: true, userId: true, avatarUrl: true, olympiadId: true },
    });

    // Count how many followers each of these users has (followingId = their id)
    const followerCounts = await Promise.all(
      followerIds.map(id => prisma.follow.count({ where: { followingId: id } }))
    );
    const followerCountMap = new Map(followerIds.map((id, i) => [id, followerCounts[i]]));

    // Which of these does the current viewer follow?
    const myFollows = await prisma.follow.findMany({
      where: { followerId: appUser.id, followingId: { in: followerIds } },
      select: { followingId: true },
    });
    const myFollowSet = new Set(myFollows.map(f => f.followingId));

    // Preserve the original order (most recent first)
    const userMap = new Map(users.map(u => [u.id, u]));
    const list = follows
      .map(f => {
        const u = userMap.get(f.followerId);
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

    return NextResponse.json(list);
  } catch (error: any) {
    console.error('followers error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
