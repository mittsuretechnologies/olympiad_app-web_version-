import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole, requireModule } from '@/lib/auth-guard';
import { recordAuditLog } from '@/lib/audit-log';
import { SUPPORT_STATUS_LABEL_TEAM, isSupportStatus, type SupportStatus } from '@/lib/schoolSupport';
import { notifySchool, TICKET_MAIL_SELECT } from '@/lib/schoolSupportNotify';

export const dynamic = 'force-dynamic';

async function guard(request: Request) {
  const { payload, error } = requireRole(request, ['SUPERADMIN', 'MODERATOR']);
  if (error) return { error };
  const moduleCheck = await requireModule(payload, 'support');
  if (moduleCheck.error) return { error: moduleCheck.error };
  return { payload };
}

// GET -> one request with its thread and the school's contact details.
//        Opening it clears the team's unread flag.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await guard(request);
  if (error) return error;
  const { id } = await params;

  try {
    const ticket = await prisma.schoolSupportTicket.findUnique({
      where: { id },
      select: {
        id: true, ticketNo: true, category: true, subject: true, priority: true, status: true,
        contactName: true, contactPhone: true, unreadByTeam: true,
        lastMessageAt: true, resolvedAt: true, createdAt: true,
        school: {
          select: {
            id: true, name: true, schoolId: true, email: true, phone: true, contactPerson: true,
            city: true, district: true, state: true,
          },
        },
        messages: {
          orderBy: { createdAt: 'asc' },
          select: { id: true, kind: true, authorRole: true, authorName: true, body: true, attachments: true, createdAt: true },
        },
      },
    });
    if (!ticket) return NextResponse.json({ message: 'Request not found' }, { status: 404 });

    if (ticket.unreadByTeam) {
      await prisma.schoolSupportTicket.update({ where: { id }, data: { unreadByTeam: false } });
    }

    return NextResponse.json({ ticket: { ...ticket, unreadByTeam: false } });
  } catch (err) {
    console.error('GET dashboard/school-support/:id failed:', err);
    return NextResponse.json({ message: 'Failed to load request' }, { status: 500 });
  }
}

// PATCH -> { status?, priority? } without a reply. A status change is logged in
// the thread (so the school sees it) and in the audit log.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { payload, error } = await guard(request);
  if (error) return error;
  const { id } = await params;

  try {
    const body = await request.json().catch(() => null);
    const status: SupportStatus | undefined = isSupportStatus(body?.status) ? body.status : undefined;
    const priority = body?.priority === 'URGENT' || body?.priority === 'NORMAL' ? body.priority : undefined;
    if (!status && !priority) {
      return NextResponse.json({ message: 'Nothing to update' }, { status: 400 });
    }

    const before = await prisma.schoolSupportTicket.findUnique({
      where: { id },
      select: { ...TICKET_MAIL_SELECT, status: true },
    });
    if (!before) return NextResponse.json({ message: 'Request not found' }, { status: 404 });

    const statusChanged = !!status && status !== before.status;
    const priorityChanged = !!priority && priority !== before.priority;
    if (!statusChanged && !priorityChanged) return NextResponse.json({ ok: true });

    const now = new Date();
    const actorName = payload.name || payload.email || 'Mittmee Support';

    await prisma.$transaction([
      prisma.schoolSupportTicket.update({
        where: { id },
        data: {
          ...(statusChanged
            ? { status, resolvedAt: status === 'RESOLVED' ? now : null, lastMessageAt: now, unreadBySchool: true }
            : {}),
          ...(priorityChanged ? { priority } : {}),
        },
      }),
      ...(statusChanged
        ? [prisma.schoolSupportMessage.create({
            data: {
              ticketId: id, kind: 'STATUS', authorRole: 'TEAM', authorId: payload.id, authorName: 'Mittmee Support',
              body: `Status changed to ${SUPPORT_STATUS_LABEL_TEAM[status!]}`, createdAt: now,
            },
          })]
        : []),
    ]);

    await recordAuditLog({
      actorId: payload.id,
      actorRole: payload.role,
      actorName,
      action: 'SCHOOL_SUPPORT_UPDATED',
      entityType: 'SchoolSupportTicket',
      entityId: id,
      previousValue: { status: before.status, priority: before.priority },
      newValue: { status: status ?? before.status, priority: priority ?? before.priority },
      reason: null,
    });

    if (statusChanged && status === 'RESOLVED') await notifySchool(before, 'RESOLVED');

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('PATCH dashboard/school-support/:id failed:', err);
    return NextResponse.json({ message: 'Failed to update request' }, { status: 500 });
  }
}
