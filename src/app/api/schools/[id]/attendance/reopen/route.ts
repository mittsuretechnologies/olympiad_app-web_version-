import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth-guard';
import { recordAuditLog } from '@/lib/audit-log';

// POST /api/schools/:id/attendance/reopen — body: { reason }
// SuperAdmin undo of a school's "Confirm & Send" on attendance. Clears
// attendanceSubmittedAt only: every PRESENT/ABSENT mark stays exactly as it
// was. The school can then edit attendance and its exam date again, and must
// confirm & send once more. Each reopen is kept in the audit log with the
// submission time it undid.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { payload, error } = await requireAdmin(request, 'schools.attendance');
  if (error) return error;

  try {
    const { id } = await params;
    const body = await request.json().catch(() => null);
    const reason = typeof body?.reason === 'string' ? body.reason.trim().slice(0, 500) : '';
    if (!reason) {
      return NextResponse.json({ message: 'Please give a reason for reopening.' }, { status: 400 });
    }

    const school = await prisma.school.findUnique({
      where: { id },
      select: { id: true, schoolId: true, name: true, examDate: true, attendanceSubmittedAt: true },
    });
    if (!school) return NextResponse.json({ message: 'School not found' }, { status: 404 });
    if (!school.attendanceSubmittedAt) {
      return NextResponse.json({ message: 'Attendance for this school is not submitted, so there is nothing to reopen.' }, { status: 409 });
    }

    // Conditional so two admins clicking at once can't both "reopen".
    const updated = await prisma.school.updateMany({
      where: { id, attendanceSubmittedAt: { not: null } },
      data: { attendanceSubmittedAt: null },
    });
    if (updated.count === 0) {
      return NextResponse.json({ message: 'Attendance was already reopened.' }, { status: 409 });
    }

    await recordAuditLog({
      actorId: payload!.id,
      actorRole: payload!.role,
      actorName: payload!.name || payload!.email || null,
      action: 'ATTENDANCE_REOPENED',
      entityType: 'School',
      entityId: school.id,
      previousValue: { attendanceSubmittedAt: school.attendanceSubmittedAt, examDate: school.examDate },
      newValue: { attendanceSubmittedAt: null },
      reason,
    });

    return NextResponse.json({ message: `Attendance reopened for ${school.name}.` });
  } catch (err) {
    console.error('POST schools/:id/attendance/reopen failed:', err);
    return NextResponse.json({ message: 'Failed to reopen attendance' }, { status: 500 });
  }
}
