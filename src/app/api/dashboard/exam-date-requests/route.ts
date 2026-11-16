import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth-guard';

// GET /api/dashboard/exam-date-requests
// Every school exam-date change request — PENDING first (oldest first, so the
// longest-waiting one is on top), then decided ones, most recent first.
export async function GET(request: Request) {
  const { error } = await requireAdmin(request, 'schools.examDateRequests');
  if (error) return error;

  try {
    const rows = await prisma.examDateChangeRequest.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true, previousDate: true, requestedDate: true, reason: true, status: true,
        remark: true, decidedByName: true, decidedAt: true, createdAt: true,
        school: {
          select: {
            id: true, schoolId: true, olympiadId: true, name: true, district: true, state: true,
            examDate: true, attendanceSubmittedAt: true,
          },
        },
      },
    });

    const pending = rows.filter(r => r.status === 'PENDING');
    const decided = rows
      .filter(r => r.status !== 'PENDING')
      .sort((a, b) => (b.decidedAt?.getTime() ?? 0) - (a.decidedAt?.getTime() ?? 0));

    return NextResponse.json([...pending, ...decided].map(r => ({
      id:                    r.id,
      status:                r.status,
      previousDate:          r.previousDate,
      requestedDate:         r.requestedDate,
      reason:                r.reason,
      remark:                r.remark,
      decidedByName:         r.decidedByName,
      decidedAt:             r.decidedAt,
      createdAt:             r.createdAt,
      schoolRefId:           r.school.id,
      schoolId:              r.school.schoolId,
      olympiadId:            r.school.olympiadId,
      schoolName:            r.school.name,
      district:              r.school.district,
      state:                 r.school.state,
      currentExamDate:       r.school.examDate,
      attendanceSubmittedAt: r.school.attendanceSubmittedAt,
    })));
  } catch (error) {
    console.error('GET /api/dashboard/exam-date-requests failed:', error);
    return NextResponse.json({ message: 'Failed to fetch requests' }, { status: 500 });
  }
}
