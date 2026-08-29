import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth-guard';

// Full per-student attendance report for one school's exam — the drill-down
// behind the SuperAdmin attendance-reports dashboard, and the source data for
// that school's PDF/Excel report export.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = requireRole(request, ['SUPERADMIN']);
  if (error) return error;

  try {
    const { id } = await params;

    const school = await prisma.school.findUnique({
      where: { id },
      select: {
        id: true, schoolId: true, olympiadId: true, name: true, city: true, state: true, district: true,
        contactPerson: true, email: true, phone: true, examDate: true, attendanceSubmittedAt: true,
      },
    });
    if (!school) return NextResponse.json({ message: 'School not found' }, { status: 404 });

    const allocations = await prisma.olympiadIdAllocation.findMany({
      where: { schoolId: id, sentAt: { not: null } },
      select: { code: true, classCode: true, className: true, assignedName: true },
    });
    const codes = allocations.map((a) => a.code);

    const [webStudents, appUsers, attendanceRecords] = await Promise.all([
      prisma.student.findMany({
        where: { allocation: { schoolId: id } },
        select: { id: true, name: true, phone: true, olympiadCode: true },
      }),
      prisma.appUser.findMany({
        where: { olympiadId: { in: codes } },
        select: { id: true, userId: true, mobile: true, olympiadId: true },
      }),
      prisma.attendance.findMany({
        where: { schoolId: id },
        select: { olympiadCode: true, status: true, markedAt: true },
      }),
    ]);

    const attendanceByCode = new Map(attendanceRecords.map((a) => [a.olympiadCode, a]));
    const webCodes = new Set(webStudents.map((s) => s.olympiadCode));
    const allocByCode = new Map(allocations.map((a) => [a.code, a]));

    const students = [
      ...webStudents.map((s) => {
        const alloc = allocByCode.get(s.olympiadCode);
        const att = attendanceByCode.get(s.olympiadCode);
        return {
          name: s.name,
          phone: s.phone,
          olympiadCode: s.olympiadCode,
          className: alloc?.className || alloc?.classCode || null,
          status: att?.status ?? 'UNMARKED',
          markedAt: att?.markedAt ?? null,
        };
      }),
      ...appUsers
        .filter((u) => !webCodes.has(u.olympiadId!))
        .map((u) => {
          const alloc = allocByCode.get(u.olympiadId!);
          const att = attendanceByCode.get(u.olympiadId!);
          return {
            name: alloc?.assignedName || u.userId,
            phone: u.mobile || '-',
            olympiadCode: u.olympiadId!,
            className: alloc?.className || alloc?.classCode || null,
            status: att?.status ?? 'UNMARKED',
            markedAt: att?.markedAt ?? null,
          };
        }),
    ].sort((a, b) => a.name.localeCompare(b.name));

    const present = students.filter((s) => s.status === 'PRESENT').length;
    const absent = students.filter((s) => s.status === 'ABSENT').length;
    const unmarked = students.filter((s) => s.status === 'UNMARKED').length;

    return NextResponse.json({
      school,
      summary: { total: students.length, present, absent, unmarked },
      students,
    });
  } catch (error) {
    console.error('GET school attendance detail failed:', error);
    return NextResponse.json({ message: 'Failed to fetch attendance report' }, { status: 500 });
  }
}
