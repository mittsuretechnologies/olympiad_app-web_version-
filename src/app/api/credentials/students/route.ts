import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const allocations = await prisma.olympiadIdAllocation.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        school: {
          select: {
            id: true,
            schoolId: true,
            name: true,
            city: true,
          },
        },
        student: {
          select: {
            id: true,
            name: true,
            phone: true,
            plainPassword: true,
            isVerified: true,
            createdAt: true,
          },
        },
      },
    });

    const result = allocations.map((a) => ({
      id: a.id,
      code: a.code,
      school: a.school,
      student: a.student ? {
        id: a.student.id,
        name: a.student.name,
        phone: a.student.phone,
        plainPassword: a.student.plainPassword,
        isVerified: a.student.isVerified,
        createdAt: a.student.createdAt,
      } : null,
    }));

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('GET credentials/students failed:', error);
    return NextResponse.json(
      { message: 'Failed to fetch student credentials', error: error?.message },
      { status: 500 }
    );
  }
}

