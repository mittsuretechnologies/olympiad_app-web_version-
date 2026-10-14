import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth-guard';
import { SUPPORT_LIMITS, cleanAttachments } from '@/lib/schoolSupport';
import { notifyTeam, TICKET_MAIL_SELECT } from '@/lib/schoolSupportNotify';

export const dynamic = 'force-dynamic';

// POST -> the school replies on one of its requests. Any school reply hands
// the request back to the support team (status OPEN) — including on a
// resolved request, which reopens it.

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { payload, error } = requireRole(request, ['SCHOOL']);
  if (error) return error;
  const { id } = await params;

  try {
    const body = await request.json().catch(() => null);
    const message = typeof body?.message === 'string' ? body.message.trim() : '';
    const attachments = cleanAttachments(body?.attachments);

    if (!message || message.length > SUPPORT_LIMITS.body) {
      return NextResponse.json({ message: `Please write a message (up to ${SUPPORT_LIMITS.body} characters).` }, { status: 400 });
    }
    if (attachments === null) {
      return NextResponse.json({ message: `You can attach up to ${SUPPORT_LIMITS.attachmentsPerMessage} files.` }, { status: 400 });
    }

    const ticket = await prisma.schoolSupportTicket.findFirst({
      where: { id, schoolId: payload.id },
      select: { ...TICKET_MAIL_SELECT, status: true },
    });
    if (!ticket) return NextResponse.json({ message: 'Request not found' }, { status: 404 });

    const now = new Date();
    const reopened = ticket.status === 'RESOLVED';

    await prisma.$transaction([
      prisma.schoolSupportMessage.create({
        data: {
          ticketId: id,
          authorRole: 'SCHOOL',
          authorId: payload.id,
          authorName: ticket.contactName || ticket.school.name,
          body: message,
          attachments: attachments.length ? (attachments as any) : undefined,
          createdAt: now,
        },
      }),
      ...(reopened
        ? [prisma.schoolSupportMessage.create({
            data: {
              ticketId: id, kind: 'STATUS', authorRole: 'SCHOOL', authorId: payload.id,
              authorName: ticket.school.name, body: 'Reopened the request', createdAt: now,
            },
          })]
        : []),
      prisma.schoolSupportTicket.update({
        where: { id },
        data: { status: 'OPEN', resolvedAt: null, unreadByTeam: true, lastMessageAt: now },
      }),
    ]);

    await notifyTeam(ticket, 'SCHOOL_REPLY', reopened ? `(Reopened) ${message}` : message, attachments.length);

    return NextResponse.json({ status: 'OPEN', reopened }, { status: 201 });
  } catch (err) {
    console.error('POST school/me/support/:id/messages failed:', err);
    return NextResponse.json({ message: 'Could not send your reply. Please try again.' }, { status: 500 });
  }
}
