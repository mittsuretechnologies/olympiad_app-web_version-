import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole, requireModule } from '@/lib/auth-guard';
import { isSupportStatus } from '@/lib/schoolSupport';

export const dynamic = 'force-dynamic';

// GET /api/dashboard/school-support?status=&category=&q= — the support team's
// inbox of School Panel requests. Unread (new school activity) first, then by
// latest activity. Gated by the same 'support' module as app-user tickets.
export async function GET(request: Request) {
  const { payload, error } = requireRole(request, ['SUPERADMIN', 'MASTER_ADMIN', 'MODERATOR']);
  if (error) return error;
  const moduleCheck = await requireModule(payload, 'support', request);
  if (moduleCheck.error) return moduleCheck.error;

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const category = searchParams.get('category');
    const q = (searchParams.get('q') || '').trim();

    const refNo = /^(?:hs-?)?(\d+)$/i.exec(q)?.[1];
    const where: Record<string, any> = {
      ...(isSupportStatus(status) ? { status } : {}),
      ...(category ? { category } : {}),
      ...(q
        ? {
            OR: [
              ...(refNo ? [{ ticketNo: Number(refNo) }] : []),
              { subject: { contains: q, mode: 'insensitive' } },
              { school: { name: { contains: q, mode: 'insensitive' } } },
              { school: { schoolId: { contains: q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [tickets, grouped, unread] = await Promise.all([
      prisma.schoolSupportTicket.findMany({
        where,
        orderBy: [{ unreadByTeam: 'desc' }, { lastMessageAt: 'desc' }],
        take: 300,
        select: {
          id: true, ticketNo: true, category: true, subject: true, priority: true, status: true,
          unreadByTeam: true, lastMessageAt: true, resolvedAt: true, createdAt: true,
          school: { select: { id: true, name: true, schoolId: true, city: true, state: true } },
          _count: { select: { messages: { where: { kind: 'MESSAGE' } } } },
        },
      }),
      prisma.schoolSupportTicket.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.schoolSupportTicket.count({ where: { unreadByTeam: true } }),
    ]);

    const counts = { OPEN: 0, IN_PROGRESS: 0, AWAITING_SCHOOL: 0, RESOLVED: 0 } as Record<string, number>;
    for (const g of grouped) counts[g.status] = g._count._all;

    return NextResponse.json({
      counts,
      unread,
      tickets: tickets.map(({ _count, ...t }) => ({ ...t, messageCount: _count.messages })),
    });
  } catch (err) {
    console.error('GET dashboard/school-support failed:', err);
    return NextResponse.json({ message: 'Failed to load school support requests' }, { status: 500 });
  }
}
