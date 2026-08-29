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

// Bulk-clears every attendance mark for this school in one go — lets a school
// undo mass mistakes before confirming. Blocked once attendanceSubmittedAt is
// set, same lock /api/school/me/attendance already enforces per-student.
export async function POST(request: Request) {
  const payload = getSchoolPayload(request);
  if (!payload) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  try {
    const school = await prisma.school.findUnique({
      where: { id: payload.id },
      select: { attendanceSubmittedAt: true },
    });
    if (school?.attendanceSubmittedAt) {
      return NextResponse.json({ message: 'Attendance has already been confirmed and sent — it can no longer be reset' }, { status: 403 });
    }

    const { count } = await prisma.attendance.deleteMany({ where: { schoolId: payload.id } });

    return NextResponse.json({ cleared: count });
  } catch (error) {
    console.error('POST school attendance reset failed:', error);
    return NextResponse.json({ message: 'Failed to reset attendance' }, { status: 500 });
  }
}
