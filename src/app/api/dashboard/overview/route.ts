import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth-guard';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { error } = await requireAdmin(request, 'overview');
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
      totalUploaders,
      totalAppUsers,
      pendingVideos,
      approvedVideos,
      rejectedVideos,
    ] = await Promise.all([
      prisma.school.count({ where: dateWhere }),
      prisma.school.count({ where: { isActive: true, ...dateWhere } }),
      prisma.olympiadIdAllocation.count({ where: dateWhere }),
      prisma.uploader.count({ where: dateWhere }),
      prisma.appUser.count({ where: dateWhere }),
      // User-deleted videos are retained in the DB for audit visibility but are
      // excluded here, the same way /api/dashboard/videos excludes them — so the
      // overview card and the moderation queue report the same numbers.
      prisma.video.count({ where: { status: 'PENDING', deletedAt: null, ...dateWhere } }),
      prisma.video.count({ where: { status: 'APPROVED', deletedAt: null, ...dateWhere } }),
      prisma.video.count({ where: { status: 'REJECTED', deletedAt: null, ...dateWhere } }),
    ]);

    // An Olympiad ID counts as "registered" when either a web Student or a
    // verified mobile AppUser has claimed it — the same rule the school's own
    // dashboard uses (api/school/me/stats). Students mostly sign up through the
    // app, so counting the Student table alone reads as 0.
    const [allocations, linkedAppUsers] = await Promise.all([
      prisma.olympiadIdAllocation.findMany({
        select: {
          code: true,
          assignedName: true,
          assignedAt: true,
          student: { select: { id: true, name: true, createdAt: true, lastLoginAt: true } },
          school: { select: { id: true, name: true, schoolId: true, city: true, state: true } },
        },
      }),
      prisma.appUser.findMany({
        where: { olympiadId: { not: null }, isVerified: true },
        select: { id: true, userId: true, olympiadId: true, createdAt: true, lastLoginAt: true },
      }),
    ]);
    const appUserByCode = new Map(linkedAppUsers.map(u => [u.olympiadId as string, u]));

    const inRange = (d: Date | null) => {
      if (!createdAtRange) return true;
      if (!d) return false;
      if (createdAtRange.gte && d < createdAtRange.gte) return false;
      if (createdAtRange.lte && d > createdAtRange.lte) return false;
      return true;
    };

    // One registration per allocation; the web Student wins if both exist.
    // Allotting an ID creates a pre-verified AppUser (api/school/me/olympiad-ids/allot),
    // so "registered" only means the school handed out credentials — loggedIn
    // (lastLoginAt stamped by the login routes) is what shows the student
    // actually used them.
    const registrations = allocations.flatMap(a => {
      if (a.student) {
        return [{ id: a.student.id, name: a.student.name, code: a.code, school: a.school, createdAt: a.student.createdAt, loggedIn: !!a.student.lastLoginAt }];
      }
      const u = appUserByCode.get(a.code);
      return u ? [{ id: u.id, name: a.assignedName || u.userId, code: a.code, school: a.school, createdAt: u.createdAt, loggedIn: !!u.lastLoginAt }] : [];
    });

    const registeredInRange = registrations.filter(r => inRange(r.createdAt));
    const totalRegisteredStudents = registeredInRange.length;
    const registeredLoggedIn = registeredInRange.filter(r => r.loggedIn).length;
    const registeredNotLoggedIn = totalRegisteredStudents - registeredLoggedIn;
    const schoolsWithRegistrations = new Set(registeredInRange.map(r => r.school.id)).size;

    // IDs a school has put a student's name against (Olympiad IDs page → assign).
    const mappedInRange = allocations.filter(a => a.assignedName?.trim() && inRange(a.assignedAt));
    const totalMappedIds = mappedInRange.length;
    const schoolsMapping = new Set(mappedInRange.map(a => a.school.id)).size;

    const totalPendingRegistrations = Math.max(totalAllocatedIds - totalRegisteredStudents, 0);
    const registrationRate = totalAllocatedIds > 0
      ? Math.round((totalRegisteredStudents / totalAllocatedIds) * 100)
      : 0;

    // Top schools by registered student count
    const registeredCodes = new Set(registrations.map(r => r.code));
    const schoolMap = new Map<string, { id: string; name: string; schoolId: string; city: string | null; state: string | null; allocated: number; registered: number }>();
    for (const a of allocations) {
      const entry = schoolMap.get(a.school.id) ?? { ...a.school, allocated: 0, registered: 0 };
      entry.allocated += 1;
      if (registeredCodes.has(a.code)) entry.registered += 1;
      schoolMap.set(a.school.id, entry);
    }
    const topSchools = Array.from(schoolMap.values())
      .filter(s => s.registered > 0)
      .map(s => ({ ...s, rate: s.allocated > 0 ? Math.round((s.registered / s.allocated) * 100) : 0 }))
      .sort((a, b) => b.registered - a.registered)
      .slice(0, 5);

    // Recent student registrations across all schools
    const recentStudents = [...registrations]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 5);

    // Recent video uploads across all sources
    const recentVideos = await prisma.video.findMany({
      where: { deletedAt: null },
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
    const yearStudents = registrations.filter(r => r.createdAt >= yearStart);
    const [yearSchools, yearAppUsers] = await Promise.all([
      prisma.school.findMany({ where: { createdAt: { gte: yearStart } }, select: { createdAt: true } }),
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
        schoolsWithRegistrations,
        registeredLoggedIn,
        registeredNotLoggedIn,
        totalMappedIds,
        schoolsMapping,
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
        olympiadCode: s.code,
        schoolName: s.school.name,
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
