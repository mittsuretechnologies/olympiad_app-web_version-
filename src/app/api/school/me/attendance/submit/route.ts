import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';

function getSchoolPayload(request: Request) {
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  try {
    const payload: any = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    if (payload?.role !== 'SCHOOL' || !payload?.id) return null;
    return payload;
  } catch {
    return null;
  }
}

// Locks in the school's attendance for its exam: every sent-out Olympiad ID
// must have a PRESENT/ABSENT mark first, then attendanceSubmittedAt freezes
// further edits (see /api/school/me/attendance) and the report becomes
// visible to SuperAdmin.
export async function POST(request: Request) {
  const payload = getSchoolPayload(request);
  if (!payload) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  try {
    const school = await prisma.school.findUnique({
      where: { id: payload.id },
      select: { examDate: true, attendanceSubmittedAt: true },
    });
    if (!school?.examDate) {
      return NextResponse.json({ message: 'No exam date set for this school' }, { status: 400 });
    }
    if (school.attendanceSubmittedAt) {
      return NextResponse.json({ message: 'Attendance has already been confirmed and sent' }, { status: 409 });
    }

    // "Total students" must match what the school actually sees and marks on
    // the registered-students page: students who claimed a sent Olympiad ID,
    // not every ID allocated — a sent-but-unclaimed ID has no student behind
    // it and can never be marked, which would make submission impossible.
    const allocations = await prisma.olympiadIdAllocation.findMany({
      where: { schoolId: payload.id, sentAt: { not: null } },
      select: { code: true },
    });
    const codes = allocations.map(a => a.code);

    const [webStudents, appUsers] = await Promise.all([
      prisma.student.findMany({
        where: { allocation: { schoolId: payload.id }, isVerified: true },
        select: { olympiadCode: true },
      }),
      prisma.appUser.findMany({
        where: { olympiadId: { in: codes }, isVerified: true },
        select: { olympiadId: true },
      }),
    ]);
    const webCodes = new Set(webStudents.map(s => s.olympiadCode));
    const appUserCount = appUsers.filter(u => !webCodes.has(u.olympiadId!)).length;
    const totalStudents = webStudents.length + appUserCount;

    if (totalStudents === 0) {
      return NextResponse.json({ message: 'No registered students to submit attendance for' }, { status: 400 });
    }

    const markedCount = await prisma.attendance.count({ where: { schoolId: payload.id } });
    if (markedCount < totalStudents) {
      return NextResponse.json(
        { message: `${totalStudents - markedCount} student(s) still unmarked — mark everyone before confirming` },
        { status: 400 }
      );
    }

    const updated = await prisma.school.update({
      where: { id: payload.id },
      data: { attendanceSubmittedAt: new Date() },
      select: { attendanceSubmittedAt: true },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('POST school attendance submit failed:', error);
    return NextResponse.json({ message: 'Failed to confirm attendance' }, { status: 500 });
  }
}
