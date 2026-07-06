import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { getReportThreshold } from '@/lib/reportSettings';

export const dynamic = 'force-dynamic';

function requireSuperAdmin(request: Request) {
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret') as any;
    return payload?.role === 'SUPERADMIN' ? payload : null;
  } catch {
    return null;
  }
}

// GET /api/dashboard/reported-videos — videos whose (unresolved) report count has
// reached the configurable threshold. SuperAdmin only.
export async function GET(request: Request) {
  const admin = requireSuperAdmin(request);
  if (!admin) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });

  try {
    const threshold = await getReportThreshold();

    const grouped = await prisma.videoReport.groupBy({
      by: ['videoId'],
      where: { resolved: false },
      _count: { _all: true },
    });
    const qualifying = grouped.filter(g => g._count._all >= threshold);
    if (qualifying.length === 0) {
      return NextResponse.json({ threshold, videos: [] });
    }

    const videoIds = qualifying.map(g => g.videoId);
    const countByVideo = new Map(qualifying.map(g => [g.videoId, g._count._all]));

    const videos = await prisma.video.findMany({
      where: { id: { in: videoIds } },
      select: {
        id: true, thumbnailUrl: true, videoUrl: true, caption: true,
        category: true, subCategory: true, isEvaluation: true,
        appUserId: true, studentId: true, createdAt: true,
        student: { select: { name: true } },
      },
    });

    const appUserIds = [...new Set(videos.map(v => v.appUserId).filter(Boolean))] as string[];
    const appUsers = appUserIds.length
      ? await prisma.appUser.findMany({ where: { id: { in: appUserIds } }, select: { id: true, userId: true } })
      : [];
    const appUserById = new Map(appUsers.map(u => [u.id, u]));

    const latestReports = await prisma.videoReport.findMany({
      where: { videoId: { in: videoIds }, resolved: false },
      orderBy: { createdAt: 'desc' },
      select: { videoId: true, category: true, createdAt: true },
    });
    const latestByVideo = new Map<string, { category: string; createdAt: Date }>();
    for (const r of latestReports) {
      if (!latestByVideo.has(r.videoId)) latestByVideo.set(r.videoId, r);
    }

    const result = videos.map(v => ({
      videoId:          v.id,
      thumbnailUrl:     v.thumbnailUrl?.replace(/^https?:\/\/[^/]+/, 'http://localhost:3000') ?? v.thumbnailUrl,
      videoUrl:         v.videoUrl?.replace(/^https?:\/\/[^/]+/, 'http://localhost:3000') ?? v.videoUrl,
      caption:          v.caption,
      category:         v.category,
      subCategory:      v.subCategory,
      isEvaluation:     v.isEvaluation,
      ownerName:        v.student?.name || appUserById.get(v.appUserId ?? '')?.userId || 'Unknown',
      reportCount:      countByVideo.get(v.id) ?? 0,
      latestCategory:   latestByVideo.get(v.id)?.category ?? null,
      latestReportDate: latestByVideo.get(v.id)?.createdAt ?? null,
    })).sort((a, b) => b.reportCount - a.reportCount);

    return NextResponse.json({ threshold, videos: result });
  } catch (error: any) {
    console.error('GET dashboard/reported-videos failed:', error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
