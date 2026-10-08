import { NextResponse } from 'next/server';
import { verify } from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { getJwtSecret } from '@/lib/jwt-secret';

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
export async function GET(request: Request) {
  if (!getAppUserFromToken(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const rows = await prisma.homeSectionVideo.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      select: {
        id: true, section: true, title: true, description: true,
        videoUrl: true, thumbnailUrl: true, viewsCount: true, inCarousel: true,
      },
    });
    return NextResponse.json({
      learning: rows.filter((r) => r.section === 'LEARNING'),
      parenting: rows.filter((r) => r.section === 'PARENTING'),
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
