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

// DELETE /api/app/followers/:followerId — remove someone who follows the current user
// (distinct from unfollow: this severs the reverse edge, follower -> me)
export async function DELETE(request: Request, { params }: { params: Promise<{ followerId: string }> }) {
  const appUser = getAppUserFromToken(request);
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { followerId } = await params;

  try {
    await prisma.follow.delete({
      where: { followerId_followingId: { followerId, followingId: appUser.id } },
    });
  } catch {
    // already not a follower — treat as success
  }

  const followersCount = await prisma.follow.count({ where: { followingId: appUser.id } });
  return NextResponse.json({ removed: true, followersCount });
}
