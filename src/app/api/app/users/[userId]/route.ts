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
export async function GET(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const appUser = getAppUserFromToken(request);
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { userId } = await params;

  try {
    const target = await prisma.appUser.findUnique({
      where: { id: userId },
      select: {
        id:        true,
        userId:    true,
        avatarUrl: true,
        olympiadId: true,
        isPrivate:  true,
        createdAt:  true,
      },
    });

    if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const isOwnProfile = appUser.id === target.id;

    // Resolve student name
    let studentName: string | null = null;
    if (target.olympiadId) {
      const allocation = await prisma.olympiadIdAllocation.findUnique({
        where:  { code: target.olympiadId },
        select: { assignedName: true, student: { select: { name: true } } },
      });
      studentName = allocation?.student?.name ?? allocation?.assignedName ?? null;
    }

    const [followersCount, followingCount] = await Promise.all([
      prisma.follow.count({ where: { followingId: target.id } }),
      prisma.follow.count({ where: { followerId:  target.id } }),
    ]);

    // Check follow relationship
    let isFollowing = false;
    let isPending   = false;
    if (!isOwnProfile) {
      const [follow, followReq] = await Promise.all([
        prisma.follow.findUnique({
          where: { followerId_followingId: { followerId: appUser.id, followingId: target.id } },
        }),
        prisma.followRequest.findUnique({
          where: { senderId_receiverId: { senderId: appUser.id, receiverId: target.id } },
        }),
      ]);
      isFollowing = !!follow;
      isPending   = followReq?.status === 'PENDING' ?? false;
    }

    // Private account: only owner or approved followers can see content
    const canSeeContent = isOwnProfile || !target.isPrivate || isFollowing;

    let videos: any[] = [];
    let videosCount = 0;

    if (canSeeContent) {
      // Show approved public videos (private olympiad videos are always hidden from profile)
      const videoWhere = {
        appUserId: target.id,
        status:    'APPROVED',
        isPublic:  true,
        deletedAt: null,
      };

      [videos, videosCount] = await Promise.all([
        prisma.video.findMany({
          where:   videoWhere,
          select: {
            id:          true,
            videoUrl:    true,
            thumbnailUrl: true,
            caption:     true,
            tags:        true,
            category:    true,
            subCategory: true,
            isEvaluation: true,
            likesCount:  true,
            viewsCount:  true,
            createdAt:   true,
          },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.video.count({ where: videoWhere }),
      ]);
    }

    return NextResponse.json({
      user: {
        id:            target.id,
        userId:        target.userId,
        avatarUrl:     target.avatarUrl,
        olympiadId:    target.olympiadId,
        isPrivate:     target.isPrivate,
        studentName,
        followersCount,
        followingCount,
        videosCount,
        isFollowing,
        isPending,
        isOwnProfile,
        canSeeContent,
        joinedAt:      target.createdAt,
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
