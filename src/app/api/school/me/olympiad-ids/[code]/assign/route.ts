import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { inactiveSchoolResponse, requireActiveSchool } from '@/lib/auth-guard';
import { allotmentRemoveLock, removeAllotment } from '@/lib/olympiad-allotment-remove';
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

// GET    → { locked: <reason> | null }  can this allotment still be removed?
// DELETE → remove the allotment (wrong child allotted). The ID goes back to
// Pending; the app account is unlinked, not deleted, and keeps working as a
// general account. See lib/olympiad-allotment-remove.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { payload, error } = await requireActiveSchool(request);
  if (error) return error;
  try {
    const { code } = await params;
    const alloc = await prisma.olympiadIdAllocation.findUnique({ where: { code }, select: { schoolId: true } });
    if (!alloc || alloc.schoolId !== payload.id) return NextResponse.json({ message: 'Olympiad ID not found' }, { status: 404 });
    return NextResponse.json({ locked: await allotmentRemoveLock(code, payload.id) });
  } catch (err) {
    console.error('GET allotment lock failed:', err);
    return NextResponse.json({ message: 'Failed to check' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { payload, error } = await requireActiveSchool(request);
  if (error) return error;
  try {
    const { code } = await params;
    const school = await prisma.school.findUnique({ where: { id: payload.id }, select: { name: true, schoolId: true } });
    const result = await removeAllotment(code, payload.id, {
      id: payload.id, role: 'SCHOOL', name: school ? `${school.name} (${school.schoolId})` : null,
    });
    if (!result.ok) return NextResponse.json({ message: result.message }, { status: result.status });
    return NextResponse.json({ success: true, unlinkedUserId: result.unlinkedUserId });
  } catch (err) {
    console.error('DELETE remove allotment failed:', err);
    return NextResponse.json({ message: 'Failed to remove allotment' }, { status: 500 });
  }
}
