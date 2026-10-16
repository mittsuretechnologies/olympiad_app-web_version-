import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole, requireModule } from '@/lib/auth-guard';
import { recordAuditLog } from '@/lib/audit-log';
import { SUPPORT_LIMITS, SUPPORT_STATUS_LABEL_TEAM, isSupportStatus, type SupportStatus } from '@/lib/schoolSupport';
import { notifySchool, TICKET_MAIL_SELECT } from '@/lib/schoolSupportNotify';

export const dynamic = 'force-dynamic';

// POST -> { message, status? } — the support team replies to the school.
// The reply carries a status (default: Awaiting school), so answering and
// moving the request along is one action. The school is emailed.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { payload, error } = requireRole(request, ['SUPERADMIN', 'MASTER_ADMIN', 'MODERATOR']);
  if (error) return error;
  const moduleCheck = await requireModule(payload, 'support', request);
  if (moduleCheck.error) return moduleCheck.error;
  const { id } = await params;

  try {
    const body = await request.json().catch(() => null);
    const message = typeof body?.message === 'string' ? body.message.trim() : '';
    const status: SupportStatus = isSupportStatus(body?.status) ? body.status : 'AWAITING_SCHOOL';

    if (!message || message.length > SUPPORT_LIMITS.body) {
      return NextResponse.json({ message: `Reply must be 1–${SUPPORT_LIMITS.body} characters.` }, { status: 400 });
    }

    const ticket = await prisma.schoolSupportTicket.findUnique({
      where: { id },
      select: { ...TICKET_MAIL_SELECT, status: true },
    });
    if (!ticket) return NextResponse.json({ message: 'Request not found' }, { status: 404 });

    const now = new Date();
    // The school sees "Mittmee Support", not the staff member's name; the
    // audit log keeps who actually replied.
    const statusChanged = status !== ticket.status;

    await prisma.$transaction([
      prisma.schoolSupportMessage.create({
        data: {
          ticketId: id, authorRole: 'TEAM', authorId: payload.id, authorName: 'Mittmee Support',
          body: message, createdAt: now,
        },
      }),
      ...(statusChanged
        ? [prisma.schoolSupportMessage.create({
            data: {
              ticketId: id, kind: 'STATUS', authorRole: 'TEAM', authorId: payload.id, authorName: 'Mittmee Support',
              body: `Status changed to ${SUPPORT_STATUS_LABEL_TEAM[status]}`,
              // A millisecond after the reply so the thread shows them in order.
              createdAt: new Date(now.getTime() + 1),
            },
          })]
        : []),
      prisma.schoolSupportTicket.update({
        where: { id },
        data: {
          status,
          resolvedAt: status === 'RESOLVED' ? now : null,
          unreadBySchool: true,
          unreadByTeam: false,
          lastMessageAt: now,
        },
      }),
    ]);

    await recordAuditLog({
      actorId: payload.id,
      actorRole: payload.role,
      actorName: payload.name || payload.email || null,
      action: 'SCHOOL_SUPPORT_REPLIED',
      entityType: 'SchoolSupportTicket',
      entityId: id,
      previousValue: { status: ticket.status },
      newValue: { status, reply: message },
      reason: null,
    });

    await notifySchool(ticket, status === 'RESOLVED' ? 'RESOLVED' : 'TEAM_REPLY', message);

    return NextResponse.json({ status }, { status: 201 });
  } catch (err) {
    console.error('POST dashboard/school-support/:id/messages failed:', err);
    return NextResponse.json({ message: 'Failed to send reply' }, { status: 500 });
  }
}
