import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = request.headers.get('authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    let payload: any;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    } catch {
      return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
    }

    if (payload?.role !== 'SCHOOL' || !payload?.id) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const studentName = (body.studentName ?? '').toString().trim();
    const studentPhone = (body.studentPhone ?? '').toString().trim();

    const existing = await prisma.olympiadIdAllocation.findUnique({
      where: { id },
      select: { schoolId: true, sentAt: true },
    });

    if (!existing) {
      return NextResponse.json({ message: 'Olympiad ID not found' }, { status: 404 });
    }
    if (existing.schoolId !== payload.id) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }
    if (!existing.sentAt) {
      return NextResponse.json(
        { message: 'This Olympiad ID has not been delivered to your school yet.' },
        { status: 400 }
      );
    }

    const wasUnassigned = !studentName && !studentPhone;
    const updated = await prisma.olympiadIdAllocation.update({
      where: { id },
      data: {
        studentName: studentName || null,
        studentPhone: studentPhone || null,
        status: wasUnassigned ? 'UNASSIGNED' : 'ASSIGNED',
        assignedAt: wasUnassigned ? null : new Date(),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('PUT school olympiad-ids/[id] failed:', error);
    return NextResponse.json({ message: 'Failed to update' }, { status: 500 });
  }
}
