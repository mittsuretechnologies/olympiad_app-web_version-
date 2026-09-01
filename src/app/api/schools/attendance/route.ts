import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth-guard';

// Aggregate attendance status across every school with an exam date, for the
// SuperAdmin attendance-reports dashboard: how many students are registered,
// how many have been marked, and whether the school has confirmed & sent.
export async function GET(request: Request) {
  const { error } = requireRole(request, ['SUPERADMIN']);
  if (error) return error;

  try {
    const schools = await prisma.school.findMany({
      where: { examDate: { not: null } },
      orderBy: { examDate: 'asc' },
      select: {
        id: true,
        schoolId: true,
        olympiadId: true,
        name: true,
        city: true,
        state: true,
        examDate: true,
        attendanceSubmittedAt: true,
        olympiadIds: {
          where: { sentAt: { not: null } },
          select: { code: true },
        },
        attendance: {
          select: { status: true },
        },
      },
    });

    // "Total" must match the school's own registered-students count — students
    // who actually claimed a sent Olympiad ID, not every ID allocated. A
    // sent-but-unclaimed ID has no student behind it and inflates the total.
    const totalsBySchool = await Promise.all(
      schools.map(async (s) => {
        const codes = s.olympiadIds.map((a) => a.code);
        const [webStudents, appUsers] = await Promise.all([
          prisma.student.findMany({
            where: { allocation: { schoolId: s.id }, isVerified: true },
            select: { olympiadCode: true },
          }),
          prisma.appUser.findMany({
            where: { olympiadId: { in: codes }, isVerified: true },
            select: { olympiadId: true },
          }),
        ]);
        const webCodes = new Set(webStudents.map((st) => st.olympiadCode));
        const appUserCount = appUsers.filter((u) => !webCodes.has(u.olympiadId!)).length;
        return webStudents.length + appUserCount;
      })
    );

    const result = schools.map((s, i) => {
      const total = totalsBySchool[i];
      const marked = s.attendance.length;
      const present = s.attendance.filter((a) => a.status === 'PRESENT').length;
      const absent = s.attendance.filter((a) => a.status === 'ABSENT').length;
      const status = s.attendanceSubmittedAt
        ? 'SUBMITTED'
        : marked === 0
        ? 'NOT_STARTED'
        : marked < total
        ? 'IN_PROGRESS'
        : 'READY_TO_SUBMIT';

      return {
        id: s.id,
        schoolId: s.schoolId,
        olympiadId: s.olympiadId,
        name: s.name,
        city: s.city,
        state: s.state,
        examDate: s.examDate,
        attendanceSubmittedAt: s.attendanceSubmittedAt,
        total,
        marked,
        present,
        absent,
        status,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('GET schools attendance failed:', error);
    return NextResponse.json({ message: 'Failed to fetch attendance overview' }, { status: 500 });
  }
}
