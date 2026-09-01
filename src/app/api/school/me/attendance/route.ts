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

// Attendance can only be marked from the school's exam day onward — never
// before it, so schools can't pre-mark students before the exam happens.
function examDayHasArrived(examDate: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exam = new Date(examDate);
  exam.setHours(0, 0, 0, 0);
  return today.getTime() >= exam.getTime();
}

export async function GET(request: Request) {
  const payload = getSchoolPayload(request);
  if (!payload) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  try {
    const school = await prisma.school.findUnique({
      where: { id: payload.id },
      select: { examDate: true, attendanceSubmittedAt: true },
    });

    const records = await prisma.attendance.findMany({
      where: { schoolId: payload.id },
      select: { olympiadCode: true, status: true, markedAt: true },
    });

    return NextResponse.json({
      examDate: school?.examDate ?? null,
      canMark: school?.examDate ? examDayHasArrived(school.examDate) : false,
      attendanceSubmittedAt: school?.attendanceSubmittedAt ?? null,
      records,
    });
  } catch (error) {
    console.error('GET school attendance failed:', error);
    return NextResponse.json({ message: 'Failed to fetch attendance' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const payload = getSchoolPayload(request);
  if (!payload) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { olympiadCode, studentId, appUserId, status } = body;

    if (!olympiadCode || !['PRESENT', 'ABSENT'].includes(status)) {
      return NextResponse.json({ message: 'olympiadCode and a valid status are required' }, { status: 400 });
    }
    if (!studentId && !appUserId) {
      return NextResponse.json({ message: 'studentId or appUserId is required' }, { status: 400 });
    }

    const school = await prisma.school.findUnique({
      where: { id: payload.id },
      select: { examDate: true, attendanceSubmittedAt: true },
    });
    if (!school?.examDate || !examDayHasArrived(school.examDate)) {
      return NextResponse.json({ message: 'Attendance can only be marked from the exam date onward' }, { status: 403 });
    }
    if (school.attendanceSubmittedAt) {
      return NextResponse.json({ message: 'Attendance has already been confirmed and sent — it can no longer be changed' }, { status: 403 });
    }

    // Ownership check: the allocation must belong to this school.
    const allocation = await prisma.olympiadIdAllocation.findUnique({
      where: { code: olympiadCode },
      select: { schoolId: true },
    });
    if (!allocation || allocation.schoolId !== payload.id) {
      return NextResponse.json({ message: 'Student not found for this school' }, { status: 404 });
    }

    const record = await prisma.attendance.upsert({
      where: { schoolId_olympiadCode: { schoolId: payload.id, olympiadCode } },
      update: { status, studentId: studentId || null, appUserId: appUserId || null, markedAt: new Date(), markedBy: payload.id },
      create: {
        schoolId: payload.id,
        olympiadCode,
        studentId: studentId || null,
        appUserId: appUserId || null,
        status,
        markedBy: payload.id,
      },
    });

    return NextResponse.json(record);
  } catch (error) {
    console.error('POST school attendance failed:', error);
    return NextResponse.json({ message: 'Failed to mark attendance' }, { status: 500 });
  }
}
