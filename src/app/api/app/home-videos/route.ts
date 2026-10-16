import { NextResponse } from 'next/server';
import { verify } from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { getJwtSecret } from '@/lib/jwt-secret';
import { visibilityWhere } from '@/lib/videoVisibility';

export const dynamic = 'force-dynamic';

function getAppUserFromToken(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  try {
    const decoded = verify(authHeader.split(' ')[1], getJwtSecret()) as any;
    return decoded.role === 'APP_USER' ? decoded : null;
  } catch { return null; }
}

// GET /api/app/home-videos — the active SuperAdmin-curated videos for the home
// screen's Learning and Parenting rows, in display order. A separate endpoint
// rather than extra rows in /api/reels/home on purpose: app builds already in
// the stores render every row that endpoint returns, and would show these as
// ordinary user videos (with like/share/report actions that can't work).
//
// General users' own Learning / Parenting uploads are normal videos: on the home
// screen they appear as ordinary "Learning" / "Parenting" category rows from
// /api/reels/home. Only with ?includeUsers=1 (the Search tiles) are they also
// appended here, after the SuperAdmin's videos, flagged userUploaded.
export async function GET(request: Request) {
  const user = getAppUserFromToken(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const includeUsers = new URL(request.url).searchParams.get('includeUsers') === '1';
  try {
    const rows = await prisma.homeSectionVideo.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      select: {
        id: true, section: true, title: true, description: true,
        videoUrl: true, thumbnailUrl: true, viewsCount: true, inCarousel: true,
      },
    });
    let fromUsers: any[] = [];
    if (includeUsers) {
      const visWhere = await visibilityWhere(user.id);
      const userRows = await prisma.video.findMany({
        where: {
          status: 'APPROVED',
          isPublic: true,
          isEvaluation: false,
          OR: [
            { category: { equals: 'Learning',  mode: 'insensitive' } },
            { category: { equals: 'Parenting', mode: 'insensitive' } },
          ],
          ...visWhere,
        },
        orderBy: { createdAt: 'desc' },
        take: 60,
        select: {
          id: true, appUserId: true, category: true, subCategory: true, caption: true, tags: true,
          videoUrl: true, thumbnailUrl: true, viewsCount: true, likesCount: true,
        },
      });
      const uploaderIds = [...new Set(userRows.map((v) => v.appUserId).filter(Boolean))] as string[];
      const [uploaders, myLikes] = await Promise.all([
        uploaderIds.length
          ? prisma.appUser.findMany({ where: { id: { in: uploaderIds } }, select: { id: true, userId: true, avatarUrl: true, schoolRefId: true } })
          : Promise.resolve([]),
        userRows.length
          ? prisma.like.findMany({ where: { userId: user.id, videoId: { in: userRows.map((v) => v.id) } }, select: { videoId: true } })
          : Promise.resolve([]),
      ]);
      const uploaderById = new Map(uploaders.map(({ schoolRefId, ...u }) => [u.id, { ...u, isOlympiadSchool: !!schoolRefId }]));
      const likedIds = new Set(myLikes.map((l) => l.videoId));
      fromUsers = userRows.map((v) => {
        const caption = (v.caption ?? '').trim();
        const section = v.category?.toLowerCase() === 'parenting' ? 'PARENTING' : 'LEARNING';
        return {
          id: v.id,
          section,
          title: caption ? caption.split(/\r?\n/)[0].slice(0, 80) : (section === 'PARENTING' ? 'Parenting video' : 'Learning video'),
          description: '',
          videoUrl: v.videoUrl,
          thumbnailUrl: v.thumbnailUrl ?? '',
          viewsCount: v.viewsCount,
          inCarousel: false,
          userUploaded: true,
          appUserId: v.appUserId,
          uploader: v.appUserId ? (uploaderById.get(v.appUserId) ?? null) : null,
          category: v.category,
          subCategory: v.subCategory,
          caption: v.caption,
          tags: v.tags,
          likesCount: v.likesCount,
          isLiked: likedIds.has(v.id),
        };
      });
    }
    const all = [...rows, ...fromUsers];

    return NextResponse.json({
      learning: all.filter((r) => r.section === 'LEARNING'),
      parenting: all.filter((r) => r.section === 'PARENTING'),
      // Videos the SuperAdmin picked for the home carousel. Learning first,
      // then Parenting, each in its row order. Older app builds ignore this key.
      carousel: [
        ...rows.filter((r) => r.inCarousel && r.section === 'LEARNING'),
        ...rows.filter((r) => r.inCarousel && r.section === 'PARENTING'),
      ],
    });
  } catch (e) {
    console.error('home-videos error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
