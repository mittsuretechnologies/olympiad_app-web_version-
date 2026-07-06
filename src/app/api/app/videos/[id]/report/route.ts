import { NextResponse } from 'next/server';
import { verify } from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

const VALID_CATEGORIES = [
  'ABUSIVE_CONTENT',
  'SPAM',
  'HARASSMENT',
  'HATE_SPEECH',
  'VIOLENCE',
  'SEXUAL_CONTENT',
  'MISINFORMATION',
  'COPYRIGHT',
  'OTHER',
];

function getAppUserFromToken(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  try {
    const decoded = verify(token, JWT_SECRET) as any;
    if (decoded.role !== 'APP_USER') return null;
    return decoded;
  } catch {
    return null;
  }
}

// POST /api/app/videos/:id/report — report a video for moderation review
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const appUser = getAppUserFromToken(request);
  if (!appUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { category, customReason } = await request.json();
    if (!category || !VALID_CATEGORIES.includes(category)) {
      return NextResponse.json({ error: 'A valid category is required' }, { status: 400 });
    }

    const video = await prisma.video.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, appUserId: true },
    });
    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    if (video.appUserId && video.appUserId === appUser.id) {
      return NextResponse.json({ error: 'You cannot report your own video' }, { status: 400 });
    }

    const report = await prisma.videoReport.create({
      data: {
        videoId:      video.id,
        reporterId:   appUser.id,
        ownerId:      video.appUserId ?? null,
        category,
        customReason: typeof customReason === 'string' ? customReason.trim().slice(0, 1000) || null : null,
      },
    });

    return NextResponse.json(report, { status: 201 });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'You have already reported this video.' }, { status: 409 });
    }
    console.error('Video report error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
