import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth-guard';
import {
  SUPPORT_LIMITS,
  cleanAttachments,
  isSupportCategory,
  isSupportStatus,
} from '@/lib/schoolSupport';
import { notifySchool, notifyTeam, TICKET_MAIL_SELECT } from '@/lib/schoolSupportNotify';

export const dynamic = 'force-dynamic';

// School Panel Help & Support.
// GET  -> this school's requests (newest activity first) + counts by status.
// POST -> raise a new request; the description becomes the first message.
// Identity always comes from the JWT, never the body.

export async function GET(request: Request) {
  const { payload, error } = requireRole(request, ['SCHOOL']);
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    const where = { schoolId: payload.id, ...(isSupportStatus(status) ? { status } : {}) };

    const [tickets, grouped] = await Promise.all([
      prisma.schoolSupportTicket.findMany({
        where,
        orderBy: { lastMessageAt: 'desc' },
        select: {
          id: true, ticketNo: true, category: true, subject: true, priority: true, status: true,
          unreadBySchool: true, lastMessageAt: true, resolvedAt: true, createdAt: true,
          _count: { select: { messages: { where: { kind: 'MESSAGE' } } } },
        },
      }),
      prisma.schoolSupportTicket.groupBy({
        by: ['status'],
        where: { schoolId: payload.id },
        _count: { _all: true },
      }),
    ]);

    const counts = { OPEN: 0, IN_PROGRESS: 0, AWAITING_SCHOOL: 0, RESOLVED: 0 } as Record<string, number>;
    for (const g of grouped) counts[g.status] = g._count._all;

    return NextResponse.json({
      counts,
      tickets: tickets.map(({ _count, ...t }) => ({ ...t, messageCount: _count.messages })),
    });
  } catch (err) {
    console.error('GET school/me/support failed:', err);
    return NextResponse.json({ message: 'Could not load your support requests.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { payload, error } = requireRole(request, ['SCHOOL']);
  if (error) return error;

  try {
    const body = await request.json().catch(() => null);
    if (!body) return NextResponse.json({ message: 'Invalid request.' }, { status: 400 });

    const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    const contactName = typeof body.contactName === 'string' ? body.contactName.trim().slice(0, 100) : '';
    const contactPhone = typeof body.contactPhone === 'string' ? body.contactPhone.trim().slice(0, 20) : '';
    const priority = body.priority === 'URGENT' ? 'URGENT' : 'NORMAL';
    const attachments = cleanAttachments(body.attachments);

    if (!isSupportCategory(body.category)) {
      return NextResponse.json({ message: 'Please choose what your request is about.' }, { status: 400 });
    }
    if (!subject || subject.length > SUPPORT_LIMITS.subject) {
      return NextResponse.json({ message: `Please enter a subject (up to ${SUPPORT_LIMITS.subject} characters).` }, { status: 400 });
    }
    if (!message || message.length > SUPPORT_LIMITS.body) {
      return NextResponse.json({ message: `Please describe the problem (up to ${SUPPORT_LIMITS.body} characters).` }, { status: 400 });
    }
    if (contactPhone && !/^[0-9+\-\s]{7,20}$/.test(contactPhone)) {
      return NextResponse.json({ message: 'Please enter a valid contact phone number.' }, { status: 400 });
    }
    if (attachments === null) {
      return NextResponse.json({ message: `You can attach up to ${SUPPORT_LIMITS.attachmentsPerMessage} files.` }, { status: 400 });
    }

    const school = await prisma.school.findUnique({ where: { id: payload.id }, select: { id: true, name: true, isActive: true } });
    if (!school || !school.isActive) return NextResponse.json({ message: 'School not found' }, { status: 404 });

    const openCount = await prisma.schoolSupportTicket.count({
      where: { schoolId: school.id, status: { not: 'RESOLVED' } },
    });
    if (openCount >= SUPPORT_LIMITS.openTicketsPerSchool) {
      return NextResponse.json(
        { message: `You already have ${openCount} open requests. Please reply on an existing request, or wait for one to be resolved.` },
        { status: 429 },
      );
    }

    const now = new Date();
    const ticket = await prisma.schoolSupportTicket.create({
      data: {
        schoolId: school.id,
        category: body.category,
        subject,
        priority,
        contactName: contactName || null,
        contactPhone: contactPhone || null,
        unreadByTeam: true,
        lastMessageAt: now,
        messages: {
          create: {
            authorRole: 'SCHOOL',
            authorId: school.id,
            authorName: contactName || school.name,
            body: message,
            attachments: attachments.length ? (attachments as any) : undefined,
            createdAt: now,
          },
        },
      },
      select: TICKET_MAIL_SELECT,
    });

    await Promise.all([
      notifyTeam(ticket, 'NEW', message, attachments.length),
      notifySchool(ticket, 'RECEIVED'),
    ]);

    return NextResponse.json({ id: ticket.id, ticketNo: ticket.ticketNo }, { status: 201 });
  } catch (err) {
    console.error('POST school/me/support failed:', err);
    return NextResponse.json({ message: 'Could not submit your request. Please try again.' }, { status: 500 });
  }
}
