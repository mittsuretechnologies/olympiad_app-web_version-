import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSuperAdmin } from './auth';
import type { StoredNoticeFile } from '@/lib/infringementFiles';
import { COPYRIGHT_DISABLED } from '@/lib/copyright';
import { NOTICE_VIDEO_SELECT, reviewDueWhere, withUploaders } from '@/lib/infringementNotices';

export const dynamic = 'force-dynamic';

const STATUSES = ['PENDING', 'CONTENT_REMOVED', 'REJECTED'];

// GET /api/dashboard/infringement-notices?status=PENDING|CONTENT_REMOVED|REJECTED|REVIEW_DUE — SuperAdmin only.
export async function GET(request: Request) {
  if (!requireSuperAdmin(request)) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });

  try {
    const status = new URL(request.url).searchParams.get('status');
    const where = status === 'REVIEW_DUE'
      ? reviewDueWhere()
      : status && STATUSES.includes(status) ? { status } : {};

    const [grouped, reviewDue, notices] = await Promise.all([
      prisma.infringementNotice.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.infringementNotice.count({ where: reviewDueWhere() }),
      prisma.infringementNotice.findMany({
        where,
        orderBy: status === 'REVIEW_DUE' ? { reviewDueAt: 'asc' } : { createdAt: 'desc' },
        include: { video: { select: NOTICE_VIDEO_SELECT } },
      }),
    ]);

    const counts: Record<string, number> = Object.fromEntries(STATUSES.map((s) => [s, 0]));
    for (const g of grouped) counts[g.status] = g._count._all;
    counts.REVIEW_DUE = reviewDue;

    return NextResponse.json({
      counts,
      notices: (await withUploaders(notices)).map((n) => ({
        ...n,
        // Storage keys stay server-side; the page asks for files by index.
        files: ((n.files as unknown as StoredNoticeFile[]) || []).map(({ name, kind, contentType, size }) => ({ name, kind, contentType, size })),
        videoDisabled: n.video?.status === COPYRIGHT_DISABLED,
      })),
    });
  } catch (error: any) {
    console.error('GET dashboard/infringement-notices failed:', error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
