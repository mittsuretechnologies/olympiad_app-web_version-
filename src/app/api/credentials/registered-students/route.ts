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
      school: s.allocation?.school || null,
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
