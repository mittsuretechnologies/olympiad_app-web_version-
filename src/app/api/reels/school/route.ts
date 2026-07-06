import { NextRequest, NextResponse } from 'next/server';
import { verify } from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { visibilityWhere } from '@/lib/videoVisibility';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

function getViewerIdFromToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  try {
    const decoded = verify(token, JWT_SECRET) as any;
    return decoded.role === 'APP_USER' ? decoded.id : null;
  } catch { return null; }
}

function fixUrlFactory() {
  const serverUrl = process.env.SERVER_URL || 'http://localhost:3000';
  return (url: string | null) => {
    if (!url) return null;
    try {
      const parsed = new URL(url);
      const target = new URL(serverUrl);
      parsed.protocol = target.protocol;
      parsed.hostname = target.hostname;
      parsed.port     = target.port;
      return parsed.toString();
    } catch { return url; }
  };
}

// GET /api/reels/school?schoolId=<id>&userId=<appUserId>
// Returns approved public videos whose uploader belongs to the given school.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get('schoolId');
    const userId   = searchParams.get('userId') ?? undefined;
    const viewerId = getViewerIdFromToken(request);

    if (!schoolId) {
      return NextResponse.json({ message: 'schoolId is required' }, { status: 400 });
    }

    const visWhere = await visibilityWhere(viewerId ?? null);
    const baseWhere = { status: 'APPROVED', isPublic: true, ...visWhere } as const;

    const fixUrl = fixUrlFactory();

    // Videos uploaded by students whose allocation school matches schoolId
    const studentVideos = await prisma.video.findMany({
      take: 30,
      where: {
        ...baseWhere,
        student: {
          allocation: { school: { id: schoolId } },
        },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, videoUrl: true, thumbnailUrl: true,
        caption: true, category: true, subCategory: true,
        likesCount: true, viewsCount: true, createdAt: true,
        appUserId: true, isEvaluation: true, olympiadVisibility: true,
        student: {
          select: {
            id: true, name: true,
            allocation: { select: { school: { select: { id: true, name: true } } } },
          },
        },
      },
    });

    // Videos uploaded by app users whose olympiadId allocation school matches
    const appUserVideos = await prisma.video.findMany({
      take: 30,
      where: {
        ...baseWhere,
        appUser: {
          olympiadId: {
            in: (await prisma.olympiadIdAllocation.findMany({
              where: { school: { id: schoolId } },
              select: { code: true },
            })).map(a => a.code),
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, videoUrl: true, thumbnailUrl: true,
        caption: true, category: true, subCategory: true,
        likesCount: true, viewsCount: true, createdAt: true,
        appUserId: true, isEvaluation: true, olympiadVisibility: true,
        student: { select: { id: true, name: true, allocation: { select: { school: { select: { id: true, name: true } } } } } },
      },
    });

    // Merge, deduplicate, sort by createdAt desc
    const seen = new Set<string>();
    const merged = [...studentVideos, ...appUserVideos]
      .filter(v => { if (seen.has(v.id)) return false; seen.add(v.id); return true; })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 30);

    // Resolve appUser info
    const appUserIds = [...new Set(merged.map(v => v.appUserId).filter(Boolean))] as string[];
    const appUsersRaw = appUserIds.length > 0
      ? await prisma.appUser.findMany({
          where: { id: { in: appUserIds } },
          select: { id: true, userId: true, avatarUrl: true },
        })
      : [];
    const appUserMap = new Map(appUsersRaw.map(u => [u.id, u]));

    // Resolve likes for authenticated user
    let likedIds = new Set<string>();
    if (userId && merged.length > 0) {
      const likes = await prisma.like.findMany({
        where: { userId, videoId: { in: merged.map(v => v.id) } },
        select: { videoId: true },
      });
      likedIds = new Set(likes.map(l => l.videoId));
    }

    const videos = merged.map(v => {
      const appUserRaw  = v.appUserId ? appUserMap.get(v.appUserId) : undefined;
      const school      = v.student?.allocation?.school ?? null;
      return {
        id:           v.id,
        videoUrl:     fixUrl(v.videoUrl) ?? v.videoUrl,
        thumbnailUrl: fixUrl(v.thumbnailUrl),
        caption:      v.caption,
        category:     v.category,
        subCategory:  v.subCategory,
        likesCount:   v.likesCount,
        viewsCount:   v.viewsCount,
        createdAt:    v.createdAt,
        isLiked:      likedIds.has(v.id),
        isEvaluation: v.isEvaluation,
        olympiadVisibility: v.olympiadVisibility,
        appUserId:    v.appUserId,
        student: v.student
          ? { id: v.student.id, name: v.student.name, schoolId: school?.id ?? null, schoolName: school?.name ?? null }
          : null,
        appUser: appUserRaw
          ? { id: appUserRaw.id, userId: appUserRaw.userId, avatarUrl: fixUrl(appUserRaw.avatarUrl) }
          : null,
      };
    });

    return NextResponse.json({ videos });
  } catch (error) {
    console.error('GET /api/reels/school failed:', error);
    return NextResponse.json({ message: 'Failed to fetch school feed' }, { status: 500 });
  }
}
