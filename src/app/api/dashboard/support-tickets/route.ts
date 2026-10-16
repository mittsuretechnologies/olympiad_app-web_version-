import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-guard';
import { prisma } from '@/lib/prisma';
import { recordAccessLog } from '@/lib/audit-log';

export const dynamic = 'force-dynamic';

// SuperAdmin, or a MasterAdmin granted the Support module.
async function requireAdminAccess(request: Request) {
  const { payload } = await requireAdmin(request, 'support');
  return payload ?? null;
}

// GET /api/dashboard/support-tickets?status=OPEN|RESOLVED — list all Help & Support queries. SuperAdmin or a granted MasterAdmin.
export async function GET(request: Request) {
  const admin = await requireAdminAccess(request);
  if (!admin) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    const where: Record<string, any> = {};
    if (status && ['OPEN', 'RESOLVED'].includes(status)) where.status = status;

    const [openCount, resolvedCount, tickets] = await Promise.all([
      prisma.supportTicket.count({ where: { status: 'OPEN' } }),
      prisma.supportTicket.count({ where: { status: 'RESOLVED' } }),
      prisma.supportTicket.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, userId: true, email: true, mobile: true, avatarUrl: true, olympiadId: true } } },
      }),
    ]);

    const result = tickets.map(t => ({
      id:             t.id,
      type:           t.type,
      category:       t.category,
      message:        t.message,
      screenshotUrls: t.screenshotUrls ? t.screenshotUrls.split(',') : [],
      status:         t.status,
      resolvedAt:     t.resolvedAt,
      adminResponse:  t.adminResponse,
      respondedAt:    t.respondedAt,
      createdAt:      t.createdAt,
      user: {
        id:         t.user.id,
        userId:     t.user.userId,
        email:      t.user.email,
        mobile:     t.user.mobile,
        avatarUrl:  t.user.avatarUrl,
        olympiadId: t.user.olympiadId,
      },
    }));

    await recordAccessLog(admin, {
      action: 'USER_DETAILS_VIEWED', entityType: 'AppUser', subjectIds: result.map(t => t.user.id), request,
    });
    return NextResponse.json({ counts: { OPEN: openCount, RESOLVED: resolvedCount }, tickets: result });
  } catch (error: any) {
    console.error('GET dashboard/support-tickets failed:', error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
