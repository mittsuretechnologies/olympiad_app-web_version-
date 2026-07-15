import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth-guard';

export async function GET(request: Request) {
  const { error } = requireRole(request, ['SUPERADMIN']);
  if (error) return error;
  try {
    // Video counts — web (studentId) + app (appUserId)
    const allWebStudents = await prisma.student.findMany({ select: { id: true } });
    const allAppUsers    = await prisma.appUser.findMany({ where: { olympiadId: { not: null } }, select: { id: true } });

    const [webVidCounts, appVidCounts] = await Promise.all([
      prisma.video.groupBy({
        by: ['studentId'],
        where: { studentId: { in: allWebStudents.map(s => s.id) }, deletedAt: null },
        _count: { id: true },
      }),
      prisma.video.groupBy({
        by: ['appUserId'],
        where: { appUserId: { in: allAppUsers.map(u => u.id) }, deletedAt: null },
        _count: { id: true },
      }),
    ]);
    const webVidById = new Map(webVidCounts.map((r: any) => [r.studentId, r._count.id]));
    const appVidById = new Map(appVidCounts.map((r: any) => [r.appUserId,  r._count.id]));

    // Web-registered students
    const webStudents = await prisma.student.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, name: true, phone: true, olympiadCode: true,
        username: true, plainPassword: true, isVerified: true, createdAt: true,
        allocation: {
          include: {
            school: {
              select: {
                id: true, schoolId: true, name: true,
                city: true, state: true, district: true, olympiadId: true,
              },
            },
          },
        },
      },
    });

    // App-registered users
    const appUsers = await prisma.appUser.findMany({
      where: { olympiadId: { not: null }, isVerified: true },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, userId: true, mobile: true,
        olympiadId: true, isVerified: true, createdAt: true,
      },
    });

    // Avoid duplicates — skip AppUsers whose olympiadId is already in Student table
    const webCodes = new Set(webStudents.map((s) => s.olympiadCode));

    // Fetch allocation+school for AppUsers
    const appCodes = appUsers.map((u) => u.olympiadId!).filter((c) => !webCodes.has(c));
    const appAllocations = await prisma.olympiadIdAllocation.findMany({
      where: { code: { in: appCodes } },
      include: {
        school: {
          select: {
            id: true, schoolId: true, name: true,
            city: true, state: true, district: true, olympiadId: true,
          },
        },
      },
    });
    const allocByCode = new Map(appAllocations.map((a) => [a.code, a]));

    const result = [
      ...webStudents.map((s) => ({
        id: s.id,
        name: s.name,
        phone: s.phone,
        olympiadCode: s.olympiadCode,
        username: s.username || null,
        plainPassword: s.plainPassword,
        isVerified: s.isVerified,
        createdAt: s.createdAt,
        source: 'web',
        totalVideos: webVidById.get(s.id) || 0,
        school: s.allocation?.school ?? null,
      })),
      ...appUsers
        .filter((u) => !webCodes.has(u.olympiadId!))
        .map((u) => {
          const alloc = allocByCode.get(u.olympiadId!);
          return {
            id: u.id,
            name: (alloc as any)?.assignedName || u.userId,
            phone: u.mobile || '-',
            olympiadCode: u.olympiadId!,
            username: u.userId,
            plainPassword: null,
            isVerified: u.isVerified,
            createdAt: u.createdAt,
            source: 'app',
            totalVideos: appVidById.get(u.id) || 0,
            school: alloc?.school ?? null,
          };
        }),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('GET credentials/registered-students failed:', error);
    return NextResponse.json(
      { message: 'Failed to fetch registered student credentials', error: error?.message },
      { status: 500 }
    );
  }
}
