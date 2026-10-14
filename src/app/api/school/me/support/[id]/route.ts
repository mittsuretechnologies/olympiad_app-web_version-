import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth-guard';

export const dynamic = 'force-dynamic';

// GET   -> one of this school's requests with its full thread; opening it
//          clears the school's unread flag.
// PATCH -> { status: 'RESOLVED' } — the school says its problem is solved.
//          (Replying on a resolved request reopens it; see ./messages.)

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { payload, error } = requireRole(request, ['SCHOOL']);
  if (error) return error;
  const { id } = await params;

  try {
    const ticket = await prisma.schoolSupportTicket.findFirst({
      where: { id, schoolId: payload.id },
      select: {
        id: true, ticketNo: true, category: true, subject: true, priority: true, status: true,
        contactName: true, contactPhone: true, unreadBySchool: true,
        lastMessageAt: true, resolvedAt: true, createdAt: true,
        messages: {
          orderBy: { createdAt: 'asc' },
          select: { id: true, kind: true, authorRole: true, authorName: true, body: true, attachments: true, createdAt: true },
        },
      },
    });
    if (!ticket) return NextResponse.json({ message: 'Request not found' }, { status: 404 });

    if (ticket.unreadBySchool) {
      await prisma.schoolSupportTicket.update({ where: { id }, data: { unreadBySchool: false } });
    }

    return NextResponse.json({ ticket: { ...ticket, unreadBySchool: false } });
  } catch (err) {
    console.error('GET school/me/support/:id failed:', err);
    return NextResponse.json({ message: 'Could not load this request.' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { payload, error } = requireRole(request, ['SCHOOL']);
  if (error) return error;
  const { id } = await params;

  try {
    const body = await request.json().catch(() => null);
    if (body?.status !== 'RESOLVED') {
      return NextResponse.json({ message: 'Only marking a request as resolved is allowed here.' }, { status: 400 });
    }

    const school = await prisma.school.findUnique({ where: { id: payload.id }, select: { id: true, name: true } });
    if (!school) return NextResponse.json({ message: 'School not found' }, { status: 404 });

    const now = new Date();
    const updated = await prisma.schoolSupportTicket.updateMany({
      where: { id, schoolId: school.id, status: { not: 'RESOLVED' } },
      data: { status: 'RESOLVED', resolvedAt: now, lastMessageAt: now, unreadByTeam: true },
    });
    if (updated.count === 0) {
      return NextResponse.json({ message: 'This request is already resolved or no longer exists.' }, { status: 409 });
    }

    await prisma.schoolSupportMessage.create({
      data: {
        ticketId: id,
        kind: 'STATUS',
        authorRole: 'SCHOOL',
        authorId: school.id,
        authorName: school.name,
        body: 'Marked the request as resolved',
        createdAt: now,
      },
    });

    return NextResponse.json({ status: 'RESOLVED' });
  } catch (err) {
    console.error('PATCH school/me/support/:id failed:', err);
    return NextResponse.json({ message: 'Could not update this request.' }, { status: 500 });
  }
}
