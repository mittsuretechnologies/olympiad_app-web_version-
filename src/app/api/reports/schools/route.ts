import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const schools = await prisma.school.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        schoolId: true,
        olympiadId: true,
        name: true,
        city: true,
        state: true,
        district: true,
        contactPerson: true,
        phone: true,
        email: true,
        createdAt: true,
        olympiadIds: {
          select: {
            code: true,
            student: {
              select: { id: true, isVerified: true },
            },
          },
        },
      },
    });

    // Fetch all AppUsers whose olympiadId matches any allocation code
    const allCodes = schools.flatMap(s => s.olympiadIds.map(o => o.code));
    const appUsers = await prisma.appUser.findMany({
      where: { olympiadId: { in: allCodes }, isVerified: true },
      select: { olympiadId: true, isVerified: true },
    });
    const appUserByCode = new Map(appUsers.map(u => [u.olympiadId!, u]));

    const result = schools.map(s => {
      const allocated = s.olympiadIds.length;

      let registered = 0;
      let verified = 0;

      for (const o of s.olympiadIds) {
        const hasWebStudent = o.student !== null;
        const hasAppUser = appUserByCode.has(o.code);

        if (hasWebStudent || hasAppUser) registered++;
        if (o.student?.isVerified || (hasAppUser && appUserByCode.get(o.code)?.isVerified)) verified++;
      }

      return {
        id: s.id,
        schoolId: s.schoolId,
        olympiadId: s.olympiadId,
        name: s.name,
        city: s.city,
        state: s.state,
        district: s.district,
        contactPerson: s.contactPerson,
        phone: s.phone,
        email: s.email,
        createdAt: s.createdAt,
        allocated,
        registered,
        verified,
      };
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('GET reports/schools failed:', error);
    return NextResponse.json({ message: 'Failed to fetch', error: error?.message }, { status: 500 });
  }
}
