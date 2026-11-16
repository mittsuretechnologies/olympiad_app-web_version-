import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { inactiveSchoolResponse } from '@/lib/auth-guard';
import { getJwtSecret } from '@/lib/jwt-secret';

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
      payload = jwt.verify(token, getJwtSecret());
    } catch {
      return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
    }

    if (payload?.role !== 'SCHOOL' || !payload?.id) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }
    const blocked = await inactiveSchoolResponse(payload.id);
    if (blocked) return blocked;

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
      payload = jwt.verify(token, getJwtSecret());
    } catch {
      return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
    }

    if (payload?.role !== 'SCHOOL' || !payload?.id) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }
    const blocked = await inactiveSchoolResponse(payload.id);
    if (blocked) return blocked;

    // Schools are not allowed to remove an allocation once it's made — they can
    // only edit the details (name/phone/email) via the app-account endpoint.
    return NextResponse.json(
      { message: 'Removing an allotted Olympiad ID is not allowed. You can edit the student details instead.' },
      { status: 403 },
    );
  } catch (error) {
    console.error('DELETE unassign failed:', error);
    return NextResponse.json({ message: 'Failed to unassign' }, { status: 500 });
  }
}
