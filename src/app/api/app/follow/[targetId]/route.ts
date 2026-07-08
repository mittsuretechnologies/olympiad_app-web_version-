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

// GET /api/app/follow/:targetId — follow status for the current user toward targetId
export async function GET(request: Request, { params }: { params: Promise<{ targetId: string }> }) {
  const appUser = getAppUserFromToken(request);
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { targetId } = await params;
  if (targetId === appUser.id) return NextResponse.json({ isFollowing: false, isPending: false });

  const [follow, request_] = await Promise.all([
    prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: appUser.id, followingId: targetId } },
    }),
    prisma.followRequest.findUnique({
      where: { senderId_receiverId: { senderId: appUser.id, receiverId: targetId } },
    }),
  ]);

  return NextResponse.json({
    isFollowing: !!follow,
    isPending:   request_?.status === 'PENDING',
  });
}

// POST /api/app/follow/:targetId — follow (or send request if target is private)
export async function POST(request: Request, { params }: { params: Promise<{ targetId: string }> }) {
  const appUser = getAppUserFromToken(request);
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { targetId } = await params;
  if (targetId === appUser.id) {
    return NextResponse.json({ error: 'Cannot follow yourself' }, { status: 400 });
  }

  const target = await prisma.appUser.findUnique({
    where: { id: targetId },
    select: { id: true, isPrivate: true },
  });
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  if (target.isPrivate) {
    // Private account: create a follow request instead
    try {
      await prisma.followRequest.upsert({
        where: { senderId_receiverId: { senderId: appUser.id, receiverId: targetId } },
        create: { senderId: appUser.id, receiverId: targetId, status: 'PENDING' },
        update: { status: 'PENDING' },
      });
    } catch (e: any) {
      console.error('follow request error:', e);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    const [followersCount, followingCount] = await Promise.all([
      prisma.follow.count({ where: { followingId: targetId } }),
      prisma.follow.count({ where: { followerId:  targetId } }),
    ]);
    return NextResponse.json({ isFollowing: false, isPending: true, followersCount, followingCount });
  }

  // Public account: follow immediately
  try {
    await prisma.follow.create({
      data: { followerId: appUser.id, followingId: targetId },
    });
  } catch (e: any) {
    if (e.code !== 'P2002') {
      console.error('follow error:', e);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
    // already following — treat as success
  }

  const [followersCount, followingCount] = await Promise.all([
    prisma.follow.count({ where: { followingId: targetId } }),
    prisma.follow.count({ where: { followerId:  targetId } }),
  ]);
  return NextResponse.json({ isFollowing: true, isPending: false, followersCount, followingCount });
}

// DELETE /api/app/follow/:targetId — unfollow or cancel pending request
export async function DELETE(request: Request, { params }: { params: Promise<{ targetId: string }> }) {
  const appUser = getAppUserFromToken(request);
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { targetId } = await params;

  // Cancel any pending follow request
  await prisma.followRequest.deleteMany({
    where: { senderId: appUser.id, receiverId: targetId, status: 'PENDING' },
  });

  // Remove follow if it exists
  try {
    await prisma.follow.delete({
      where: { followerId_followingId: { followerId: appUser.id, followingId: targetId } },
    });
  } catch {
    // not following — ok
  }

  const [followersCount, followingCount] = await Promise.all([
    prisma.follow.count({ where: { followingId: targetId } }),
    prisma.follow.count({ where: { followerId:  targetId } }),
  ]);
  return NextResponse.json({ isFollowing: false, isPending: false, followersCount, followingCount });
}
