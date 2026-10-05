import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSuperAdmin } from '../auth';

export const dynamic = 'force-dynamic';

const STATUSES = ['PENDING', 'CONTENT_REMOVED', 'REJECTED'];

// PATCH /api/dashboard/infringement-notices/:noticeId — body: { status?, adminNotes? }
export async function PATCH(request: Request, { params }: { params: Promise<{ noticeId: string }> }) {
  if (!requireSuperAdmin(request)) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });

  try {
    const { noticeId } = await params;
    const { status, adminNotes } = await request.json();
    const data: Record<string, any> = {};

    if (status !== undefined) {
      if (!STATUSES.includes(status)) return NextResponse.json({ message: 'Invalid status' }, { status: 400 });
      data.status = status;
      data.resolvedAt = status === 'PENDING' ? null : new Date();
    }
    if (adminNotes !== undefined) {
      data.adminNotes = typeof adminNotes === 'string' && adminNotes.trim() ? adminNotes.trim().slice(0, 5000) : null;
    }

    const updated = await prisma.infringementNotice.update({ where: { id: noticeId }, data });
    return NextResponse.json({ id: updated.id, status: updated.status, adminNotes: updated.adminNotes });
  } catch (error: any) {
    if (error?.code === 'P2025') return NextResponse.json({ message: 'Notice not found' }, { status: 404 });
    console.error('PATCH dashboard/infringement-notices/:noticeId failed:', error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
