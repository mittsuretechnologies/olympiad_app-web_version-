import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const auth = request.headers.get('authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    let payload: any;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    } catch {
      return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
    }

    if (payload?.role !== 'SCHOOL' || !payload?.id) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const { code } = await params;
    const { assignedName } = await request.json();

    if (!assignedName || !assignedName.trim()) {
      return NextResponse.json({ message: 'Student name is required' }, { status: 400 });
    }

    // Verify this allocation belongs to this school
    const allocation = await prisma.olympiadIdAllocation.findUnique({
      where: { code },
      include: { student: true },
    });

    if (!allocation) {
      return NextResponse.json({ message: 'Olympiad ID not found' }, { status: 404 });
    }
    if (allocation.schoolId !== payload.id) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }
    if (allocation.student) {
      return NextResponse.json({ message: 'This ID is already registered by a student' }, { status: 409 });
    }

    const updated = await prisma.olympiadIdAllocation.update({
      where: { code },
      data: {
        assignedName: assignedName.trim(),
        assignedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, assignedName: updated.assignedName });
  } catch (error) {
    console.error('PATCH assign failed:', error);
    return NextResponse.json({ message: 'Failed to assign' }, { status: 500 });
  }
}

// Unassign
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const auth = request.headers.get('authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    let payload: any;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    } catch {
      return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
    }

    if (payload?.role !== 'SCHOOL' || !payload?.id) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const { code } = await params;

    const allocation = await prisma.olympiadIdAllocation.findUnique({ where: { code }, include: { student: true } });
    if (!allocation) return NextResponse.json({ message: 'Not found' }, { status: 404 });
    if (allocation.schoolId !== payload.id) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    if (allocation.student) return NextResponse.json({ message: 'Cannot unassign — student already registered' }, { status: 409 });

    // If an app account was created via Allot Student, remove it too so the ID becomes available again
    await prisma.appUser.deleteMany({ where: { olympiadId: code } });

    await prisma.olympiadIdAllocation.update({
      where: { code },
      data: { assignedName: null, assignedAt: null },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE unassign failed:', error);
    return NextResponse.json({ message: 'Failed to unassign' }, { status: 500 });
  }
}
