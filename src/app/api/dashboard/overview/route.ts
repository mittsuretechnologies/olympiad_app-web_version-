import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
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
      prisma.school.count(),
      prisma.school.count({ where: { isActive: true } }),
      prisma.olympiadIdAllocation.count(),
      prisma.student.count(),
      prisma.uploader.count(),
      prisma.appUser.count(),
      prisma.video.count({ where: { status: 'PENDING' } }),
      prisma.video.count({ where: { status: 'APPROVED' } }),
      prisma.video.count({ where: { status: 'REJECTED' } }),
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
    });
  } catch (error) {
    console.error('GET dashboard/overview failed:', error);
    return NextResponse.json({ message: 'Failed to fetch overview' }, { status: 500 });
  }
}
