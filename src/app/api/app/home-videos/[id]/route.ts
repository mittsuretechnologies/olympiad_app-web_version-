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

// GET /api/app/home-videos/:id — one active SuperAdmin Learning / Parenting video,
// same row shape as the list endpoint. Used to open a shared link to one.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getAppUserFromToken(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { id } = await params;
    const row = await prisma.homeSectionVideo.findFirst({
      where: { id, isActive: true },
      select: {
        id: true, section: true, title: true, description: true,
        videoUrl: true, thumbnailUrl: true, viewsCount: true, inCarousel: true, likesCount: true,
      },
    });
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const like = await prisma.homeSectionVideoLike.findFirst({
      where: { userId: user.id, videoId: id }, select: { videoId: true },
    });
    return NextResponse.json({ video: { ...row, isLiked: !!like } });
  } catch (e) {
    console.error('home-video get error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
