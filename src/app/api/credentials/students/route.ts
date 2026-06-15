import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const allocations = await prisma.olympiadIdAllocation.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        school: {
          select: { id: true, schoolId: true, name: true, city: true },
        },
        student: {
          select: {
            id: true, name: true, phone: true,
            username: true, plainPassword: true,
            isVerified: true, createdAt: true,
          },
        },
      },
    });


    // Fetch all AppUsers who registered via mobile app
    const codes = allocations.map((a) => a.code);
    const appUsers = await prisma.appUser.findMany({
      where: { olympiadId: { in: codes } },
      select: {
        id: true, userId: true, mobile: true,
        olympiadId: true, isVerified: true, createdAt: true,
        plainPassword: true,
      },
    });
    const appUserByCode = new Map(appUsers.map((u) => [u.olympiadId, u]));

    const result = allocations.map((a) => {
      // Web-registered Student takes priority
      if (a.student) {
        return {
          id: a.id,
          code: a.code,
          school: a.school,
          student: {
            id: a.student.id,
            name: a.student.name,
            phone: a.student.phone,
            username: a.student.username,
            plainPassword: a.student.plainPassword,
            isVerified: a.student.isVerified,
            createdAt: a.student.createdAt,
            source: 'web',
          },
        };
      }

      // App-registered AppUser — prefer school's assignedName over app userId
      const appUser = appUserByCode.get(a.code);
      if (appUser) {
        return {
          id: a.id,
          code: a.code,
          school: a.school,
          student: {
            id: appUser.id,
            name: a.assignedName || appUser.userId,
            phone: appUser.mobile || '-',
            username: appUser.userId,
            plainPassword: appUser.plainPassword || null,
            isVerified: appUser.isVerified,
            createdAt: appUser.createdAt,
            source: 'app',
          },
        };
      }

      // Not registered yet
      return { id: a.id, code: a.code, school: a.school, student: null };
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('GET credentials/students failed:', error);
    return NextResponse.json(
      { message: 'Failed to fetch student credentials', error: error?.message },
      { status: 500 }
    );
  }
}
