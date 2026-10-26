import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth-guard';

export const dynamic = 'force-dynamic';

// Schools whose exam is today (IST calendar day) and whether each has
// confirmed & sent its attendance report (School.attendanceSubmittedAt).
export async function GET(request: Request) {
  const { error } = await requireAdmin(request, 'overview');
  if (error) return error;
  try {
    const istNow = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
    const todayKey = istNow.toISOString().slice(0, 10);
    const dayStart = new Date(`${todayKey}T00:00:00.000Z`);
    const dayEnd = new Date(`${todayKey}T23:59:59.999Z`);

    const schools = await prisma.school.findMany({
      where: { examDate: { gte: dayStart, lte: dayEnd } },
      orderBy: { name: 'asc' },
      select: {
        id: true, name: true, schoolId: true, city: true, state: true,
        attendanceSubmittedAt: true,
        attendance: { select: { status: true } },
      },
    });

    const rows = schools.map(s => ({
      id: s.id,
      name: s.name,
      schoolId: s.schoolId,
      city: s.city,
      state: s.state,
      submittedAt: s.attendanceSubmittedAt ? s.attendanceSubmittedAt.toISOString() : null,
      present: s.attendance.filter(a => a.status === 'PRESENT').length,
      absent: s.attendance.filter(a => a.status === 'ABSENT').length,
    }));

    // Sent reports first (latest on top), then the schools still pending.
    rows.sort((a, b) => {
      if (a.submittedAt && b.submittedAt) return b.submittedAt.localeCompare(a.submittedAt);
      if (a.submittedAt) return -1;
      if (b.submittedAt) return 1;
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({ today: todayKey, schools: rows });
  } catch (error) {
    console.error('GET dashboard/today-attendance failed:', error);
    return NextResponse.json({ message: 'Failed to fetch today attendance' }, { status: 500 });
  }
}
