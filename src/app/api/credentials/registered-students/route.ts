import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const students = await prisma.student.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        allocation: {
          include: {
            school: {
              select: {
                id: true,
                schoolId: true,
                name: true,
                city: true,
                state: true,
                district: true,
                olympiadId: true,
              },
            },
          },
        },
      },
    });

    const result = students.map((s) => ({
      id: s.id,
      name: s.name,
      phone: s.phone,
      olympiadCode: s.olympiadCode,
      plainPassword: s.plainPassword,
      isVerified: s.isVerified,
      createdAt: s.createdAt,
      school: s.allocation?.school
        ? {
            id: s.allocation.school.id,
            schoolId: s.allocation.school.schoolId,
            name: s.allocation.school.name,
            city: s.allocation.school.city,
            state: s.allocation.school.state,
            district: s.allocation.school.district,
            olympiadId: s.allocation.school.olympiadId,
          }
        : null,
    }));

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('GET credentials/registered-students failed:', error);
    return NextResponse.json(
      { message: 'Failed to fetch registered student credentials', error: error?.message },
      { status: 500 }
    );
  }
}
