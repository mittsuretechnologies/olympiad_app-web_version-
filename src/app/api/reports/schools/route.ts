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
            id: true,
            student: {
              select: { id: true, isVerified: true },
            },
          },
        },
      },
    });

    const result = schools.map(s => ({
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
      allocated: s.olympiadIds.length,
      registered: s.olympiadIds.filter(o => o.student !== null).length,
      verified: s.olympiadIds.filter(o => o.student?.isVerified).length,
    }));

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('GET reports/schools failed:', error);
    return NextResponse.json({ message: 'Failed to fetch', error: error?.message }, { status: 500 });
  }
}
