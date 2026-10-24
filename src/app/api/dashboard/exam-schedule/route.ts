import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth-guard';

export const dynamic = 'force-dynamic';

// Schools whose exam is today or later, soonest first — today's schools lead
// the list, then each following date in ascending order. Exam dates are
// calendar days (stored from a date input), so "today" is the IST calendar day.
export async function GET(request: Request) {
  const { error } = await requireAdmin(request, 'overview');
  if (error) return error;
  try {
    const istNow = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
    const todayKey = istNow.toISOString().slice(0, 10);
    const todayStart = new Date(`${todayKey}T00:00:00.000Z`);

    const schools = await prisma.school.findMany({
      where: { examDate: { gte: todayStart } },
      orderBy: [{ examDate: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, schoolId: true, city: true, state: true, examDate: true, isActive: true },
    });

    return NextResponse.json({
      today: todayKey,
      schools: schools.map(s => ({
        id: s.id,
        name: s.name,
        schoolId: s.schoolId,
        city: s.city,
        state: s.state,
        isActive: s.isActive,
        examDate: s.examDate!.toISOString().slice(0, 10),
      })),
    });
  } catch (error) {
    console.error('GET dashboard/exam-schedule failed:', error);
    return NextResponse.json({ message: 'Failed to fetch exam schedule' }, { status: 500 });
  }
}
