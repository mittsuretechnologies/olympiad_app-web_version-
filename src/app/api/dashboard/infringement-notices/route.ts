import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSuperAdmin } from './auth';
import type { StoredNoticeFile } from '@/lib/infringementFiles';

export const dynamic = 'force-dynamic';

const STATUSES = ['PENDING', 'CONTENT_REMOVED', 'REJECTED'];

// GET /api/dashboard/infringement-notices?status=PENDING|CONTENT_REMOVED|REJECTED — SuperAdmin only.
export async function GET(request: Request) {
  if (!requireSuperAdmin(request)) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });

  try {
    const status = new URL(request.url).searchParams.get('status');
    const where = status && STATUSES.includes(status) ? { status } : {};

    const [grouped, notices] = await Promise.all([
      prisma.infringementNotice.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.infringementNotice.findMany({ where, orderBy: { createdAt: 'desc' } }),
    ]);

    const counts = Object.fromEntries(STATUSES.map((s) => [s, 0]));
    for (const g of grouped) counts[g.status] = g._count._all;

    return NextResponse.json({
      counts,
      notices: notices.map((n) => ({
        ...n,
        // Storage keys stay server-side; the page asks for files by index.
        files: ((n.files as unknown as StoredNoticeFile[]) || []).map(({ name, kind, contentType, size }) => ({ name, kind, contentType, size })),
      })),
    });
  } catch (error: any) {
    console.error('GET dashboard/infringement-notices failed:', error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
