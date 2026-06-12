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

// GET /api/app/follow/:targetId — is the current user following targetId?
export async function GET(request: Request, { params }: { params: Promise<{ targetId: string }> }) {
  const appUser = getAppUserFromToken(request);
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { targetId } = await params;
  if (targetId === appUser.id) return NextResponse.json({ isFollowing: false });

  const follow = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId: appUser.id, followingId: targetId } },
  });
  return NextResponse.json({ isFollowing: !!follow });
}

// POST /api/app/follow/:targetId — follow
export async function POST(request: Request, { params }: { params: Promise<{ targetId: string }> }) {
  const appUser = getAppUserFromToken(request);
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { targetId } = await params;
  if (targetId === appUser.id) {
    return NextResponse.json({ error: 'Cannot follow yourself' }, { status: 400 });
  }

  const target = await prisma.appUser.findUnique({ where: { id: targetId }, select: { id: true } });
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  try {
    await prisma.follow.create({
      data: { followerId: appUser.id, followingId: targetId },
    });
  } catch (e: any) {
    if (e.code === 'P2002') {
      // already following — treat as success
    } else {
      console.error('follow error:', e);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }

  const [followersCount, followingCount] = await Promise.all([
    prisma.follow.count({ where: { followingId: targetId } }),
    prisma.follow.count({ where: { followerId:  targetId } }),
  ]);

  return NextResponse.json({ isFollowing: true, followersCount, followingCount });
}

// DELETE /api/app/follow/:targetId — unfollow
export async function DELETE(request: Request, { params }: { params: Promise<{ targetId: string }> }) {
  const appUser = getAppUserFromToken(request);
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { targetId } = await params;

  try {
    await prisma.follow.delete({
      where: { followerId_followingId: { followerId: appUser.id, followingId: targetId } },
    });
  } catch {
    // already not following — treat as success
  }

  const [followersCount, followingCount] = await Promise.all([
    prisma.follow.count({ where: { followingId: targetId } }),
    prisma.follow.count({ where: { followerId:  targetId } }),
  ]);

  return NextResponse.json({ isFollowing: false, followersCount, followingCount });
}
