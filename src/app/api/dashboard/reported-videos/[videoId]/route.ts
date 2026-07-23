import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { requireModule } from '@/lib/auth-guard';

export const dynamic = 'force-dynamic';

function requireModerationAccess(request: Request) {
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret') as any;
    return ['SUPERADMIN', 'MODERATOR'].includes(payload?.role) ? payload : null;
  } catch {
    return null;
  }
}

// GET /api/dashboard/reported-videos/:videoId — full report detail for one video
export async function GET(
  request: Request,
  { params }: { params: Promise<{ videoId: string }> }
) {
  const admin = requireModerationAccess(request);
  if (!admin) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });

  const moduleCheck = await requireModule(admin, 'moderation.reported');
  if (moduleCheck.error) return moduleCheck.error;

  const { videoId } = await params;

  try {
    const video = await prisma.video.findUnique({
      where: { id: videoId },
      include: { student: { select: { name: true } } },
    });
    if (!video) return NextResponse.json({ message: 'Video not found' }, { status: 404 });

    const ownerAppUser = video.appUserId
      ? await prisma.appUser.findUnique({ where: { id: video.appUserId }, select: { userId: true } })
      : null;

    const reports = await prisma.videoReport.findMany({
      where: { videoId },
      orderBy: { createdAt: 'desc' },
      include: { reporter: { select: { userId: true } } },
    });

    return NextResponse.json({
      video: {
        id: video.id,
        videoUrl: video.videoUrl,
        thumbnailUrl: video.thumbnailUrl,
        caption: video.caption,
        category: video.category,
        subCategory: video.subCategory,
        isEvaluation: video.isEvaluation,
        ownerName: video.student?.name || ownerAppUser?.userId || 'Unknown',
        createdAt: video.createdAt,
        deletedAt: video.deletedAt,
      },
      reports: reports.map(r => ({
        id: r.id,
        category: r.category,
        customReason: r.customReason,
        resolved: r.resolved,
        createdAt: r.createdAt,
        reporterName: r.reporter?.userId ?? 'Unknown',
      })),
    });
  } catch (error: any) {
    console.error('GET dashboard/reported-videos/:videoId failed:', error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
