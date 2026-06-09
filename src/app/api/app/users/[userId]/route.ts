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

function normalizeUrl(url: string | null) {
  if (!url) return url;
  return url.replace(/^https?:\/\/[^/]+/, 'http://10.0.2.2:3000');
}

// GET /api/app/users/:userId — public profile by appUser UUID
export async function GET(request: Request, { params }: { params: { userId: string } }) {
  const appUser = getAppUserFromToken(request);
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { userId } = params; // UUID (id field)

  try {
    const target = await prisma.appUser.findUnique({
      where: { id: userId },
      select: {
        id: true,
        userId: true,
        avatarUrl: true,
        olympiadId: true,
        createdAt: true,
      },
    });

    if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // Use raw counts to avoid any relation-mapping issues
    const [followersCount, followingCount, videosCount] = await Promise.all([
      prisma.follow.count({ where: { followingId: target.id } }),
      prisma.follow.count({ where: { followerId:  target.id } }),
      prisma.video.count({ where: { appUserId: target.id, status: 'APPROVED', isPublic: true } }),
    ]);

    // Check if current user follows this person
    const isFollowing = appUser.id !== target.id
      ? !!(await prisma.follow.findUnique({
          where: { followerId_followingId: { followerId: appUser.id, followingId: target.id } },
        }))
      : false;

    // Get their approved public videos
    const videos = await prisma.video.findMany({
      where: { appUserId: target.id, status: 'APPROVED', isPublic: true },
      select: {
        id: true,
        videoUrl: true,
        thumbnailUrl: true,
        caption: true,
        category: true,
        subCategory: true,
        isEvaluation: true,
        likesCount: true,
        viewsCount: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      user: {
        id:             target.id,
        userId:         target.userId,
        avatarUrl:      target.avatarUrl,
        olympiadId:     target.olympiadId,
        followersCount,
        followingCount,
        videosCount,
        isFollowing,
        isOwnProfile:   appUser.id === target.id,
        joinedAt:       target.createdAt,
      },
      videos: videos.map(v => ({
        ...v,
        videoUrl:     normalizeUrl(v.videoUrl),
        thumbnailUrl: normalizeUrl(v.thumbnailUrl),
      })),
    });
  } catch (error: any) {
    console.error('public profile error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
