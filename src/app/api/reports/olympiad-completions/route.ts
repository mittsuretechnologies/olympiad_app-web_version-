import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // Web students with 2 approved evaluation videos
    const webVideos = await prisma.video.groupBy({
      by: ['studentId'],
      where: { isEvaluation: true, status: 'APPROVED', studentId: { not: null } },
      _count: { id: true },
      having: { id: { _count: { gte: 2 } } },
    });
    const completedWebIds = webVideos.map((r) => r.studentId as string);

    // App users with 2 approved evaluation videos
    const appVideos = await prisma.video.groupBy({
      by: ['appUserId'],
      where: { isEvaluation: true, status: 'APPROVED', appUserId: { not: null } },
      _count: { id: true },
      having: { id: { _count: { gte: 2 } } },
    });
    const completedAppIds = appVideos.map((r) => r.appUserId as string);

    const webVidCountById = new Map(webVideos.map((r) => [r.studentId as string, r._count.id]));
    const appVidCountById = new Map(appVideos.map((r) => [r.appUserId as string, r._count.id]));

    // Fetch web students
    const webStudents = await prisma.student.findMany({
      where: { id: { in: completedWebIds } },
      select: {
        id: true, name: true, phone: true, username: true, olympiadCode: true, createdAt: true,
        allocation: {
          select: {
            classCode: true, className: true, assignedName: true,
            school: {
              select: { id: true, schoolId: true, name: true, city: true, state: true, district: true },
            },
          },
        },
      },
    });

    // Fetch app users
    const appUsers = await prisma.appUser.findMany({
      where: { id: { in: completedAppIds } },
      select: { id: true, userId: true, mobile: true, olympiadId: true, createdAt: true },
    });

    // Fetch allocations for app users
    const appCodes = appUsers.map((u) => u.olympiadId!).filter(Boolean);
    const appAllocations = await prisma.olympiadIdAllocation.findMany({
      where: { code: { in: appCodes } },
      select: {
        code: true, classCode: true, className: true, assignedName: true,
        school: {
          select: { id: true, schoolId: true, name: true, city: true, state: true, district: true },
        },
      },
    });
    const allocByCode = new Map(appAllocations.map((a) => [a.code, a]));

    // Web student olympiad codes — to deduplicate app users who also have a Student record
    const webCodes = new Set(webStudents.map((s) => s.olympiadCode));

    const result = [
      ...webStudents.map((s) => ({
        id: s.id,
        name: s.allocation?.assignedName || s.name,
        username: s.username || null,
        phone: s.phone,
        olympiadCode: s.olympiadCode,
        approvedVideos: webVidCountById.get(s.id) || 2,
        classCode: s.allocation?.classCode || null,
        className: s.allocation?.className || null,
        source: 'web' as const,
        completedAt: s.createdAt,
        school: s.allocation?.school ?? null,
      })),
      ...appUsers
        .filter((u) => !webCodes.has(u.olympiadId!))
        .map((u) => {
          const alloc = allocByCode.get(u.olympiadId!);
          return {
            id: u.id,
            name: alloc?.assignedName || u.userId,
            username: u.userId,
            phone: u.mobile || '-',
            olympiadCode: u.olympiadId!,
            approvedVideos: appVidCountById.get(u.id) || 2,
            classCode: alloc?.classCode || null,
            className: alloc?.className || null,
            source: 'app' as const,
            completedAt: u.createdAt,
            school: alloc?.school ?? null,
          };
        }),
    ].sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('GET reports/olympiad-completions failed:', error);
    return NextResponse.json(
      { message: 'Failed to fetch completions', error: error?.message },
      { status: 500 }
    );
  }
}
