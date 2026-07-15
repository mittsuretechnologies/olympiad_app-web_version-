import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth-guard';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { error } = requireRole(request, ['SUPERADMIN']);
  if (error) return error;
  try {
    const { searchParams } = new URL(request.url);
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');

    const createdAtRange = (fromParam || toParam) ? {
      ...(fromParam ? { gte: new Date(fromParam) } : {}),
      ...(toParam ? { lte: new Date(`${toParam}T23:59:59.999`) } : {}),
    } : undefined;

    const dateWhere = createdAtRange ? { createdAt: createdAtRange } : {};

    const [
      totalSchools,
      activeSchools,
      totalAllocatedIds,
      totalRegisteredStudents,
      totalUploaders,
      totalAppUsers,
      pendingVideos,
      approvedVideos,
      rejectedVideos,
    ] = await Promise.all([
      prisma.school.count({ where: dateWhere }),
      prisma.school.count({ where: { isActive: true, ...dateWhere } }),
      prisma.olympiadIdAllocation.count({ where: dateWhere }),
      prisma.student.count({ where: dateWhere }),
      prisma.uploader.count({ where: dateWhere }),
      prisma.appUser.count({ where: dateWhere }),
      prisma.video.count({ where: { status: 'PENDING', ...dateWhere } }),
      prisma.video.count({ where: { status: 'APPROVED', ...dateWhere } }),
      prisma.video.count({ where: { status: 'REJECTED', ...dateWhere } }),
    ]);

    const totalPendingRegistrations = totalAllocatedIds - totalRegisteredStudents;
    const registrationRate = totalAllocatedIds > 0
      ? Math.round((totalRegisteredStudents / totalAllocatedIds) * 100)
      : 0;

    // Top schools by registered student count
    const schools = await prisma.school.findMany({
      select: {
        id: true,
        name: true,
        schoolId: true,
        city: true,
        state: true,
        olympiadIds: {
          select: { id: true, student: { select: { id: true } } },
        },
      },
    });

    const topSchools = schools
      .map(s => {
        const allocated = s.olympiadIds.length;
        const registered = s.olympiadIds.filter(a => a.student !== null).length;
        return {
          id: s.id,
          name: s.name,
          schoolId: s.schoolId,
          city: s.city,
          state: s.state,
          allocated,
          registered,
          rate: allocated > 0 ? Math.round((registered / allocated) * 100) : 0,
        };
      })
      .sort((a, b) => b.registered - a.registered)
      .slice(0, 5);

    // Recent student registrations across all schools
    const recentStudents = await prisma.student.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        name: true,
        olympiadCode: true,
        createdAt: true,
        allocation: { select: { school: { select: { name: true } } } },
      },
    });

    // Recent video uploads across all sources
    const recentVideos = await prisma.video.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        caption: true,
        status: true,
        createdAt: true,
        uploaderType: true,
        student: { select: { name: true } },
      },
    });

    // Monthly trend for the current calendar year — schools, school
    // students, and app users registered per month, for the overview line chart.
    const yearStart = new Date(new Date().getFullYear(), 0, 1);
    const [yearSchools, yearStudents, yearAppUsers] = await Promise.all([
      prisma.school.findMany({ where: { createdAt: { gte: yearStart } }, select: { createdAt: true } }),
      prisma.student.findMany({ where: { createdAt: { gte: yearStart } }, select: { createdAt: true } }),
      prisma.appUser.findMany({ where: { createdAt: { gte: yearStart } }, select: { createdAt: true } }),
    ]);

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const countByMonth = (rows: { createdAt: Date }[]) => {
      const counts = new Array(12).fill(0);
      for (const r of rows) counts[r.createdAt.getMonth()]++;
      return counts;
    };
    const schoolsByMonth = countByMonth(yearSchools);
    const studentsByMonth = countByMonth(yearStudents);
    const appUsersByMonth = countByMonth(yearAppUsers);

    const monthlyTrend = monthNames.map((month, i) => ({
      month,
      schools: schoolsByMonth[i],
      schoolStudents: studentsByMonth[i],
      appUsers: appUsersByMonth[i],
    }));

    return NextResponse.json({
      stats: {
        totalSchools,
        activeSchools,
        totalAllocatedIds,
        totalRegisteredStudents,
        totalPendingRegistrations,
        registrationRate,
        totalUploaders,
        totalAppUsers,
        pendingVideos,
        approvedVideos,
        rejectedVideos,
      },
      topSchools,
      recentStudents: recentStudents.map(s => ({
        id: s.id,
        name: s.name,
        olympiadCode: s.olympiadCode,
        schoolName: s.allocation?.school?.name ?? '-',
        createdAt: s.createdAt.toISOString(),
      })),
      recentVideos: recentVideos.map(v => ({
        id: v.id,
        caption: v.caption,
        status: v.status,
        uploaderType: v.uploaderType,
        studentName: v.student?.name ?? null,
        createdAt: v.createdAt.toISOString(),
      })),
      monthlyTrend,
    });
  } catch (error) {
    console.error('GET dashboard/overview failed:', error);
    return NextResponse.json({ message: 'Failed to fetch overview' }, { status: 500 });
  }
}
