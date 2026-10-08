import { NextResponse } from 'next/server';
import { verify } from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { getJwtSecret } from '@/lib/jwt-secret';

function getAppUserFromToken(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  try {
    const decoded = verify(authHeader.split(' ')[1], getJwtSecret()) as any;
    return decoded.role === 'APP_USER' ? decoded : null;
  } catch { return null; }
}

// POST /api/app/home-videos/:id/view — counts one play of a Learning/Parenting
// video. A simple counter (the only interaction these videos have); hidden
// videos aren't counted.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!getAppUserFromToken(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { id } = await params;
    const result = await prisma.homeSectionVideo.updateMany({
      where: { id, isActive: true },
      data: { viewsCount: { increment: 1 } },
    });
    if (result.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('home-video view error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
