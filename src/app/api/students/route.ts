import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get('schoolId');

    const students = await prisma.student.findMany({
      where: schoolId
        ? { allocation: { school: { id: schoolId } } }
        : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        allocation: {
          select: {
            code: true,
            sentAt: true,
            school: {
              select: { schoolId: true, name: true, city: true, state: true },
            },
          },
        },
      },
    });

    return NextResponse.json(students);
  } catch (error) {
    console.error('GET /api/students failed:', error);
    return NextResponse.json({ message: 'Failed to fetch students' }, { status: 500 });
  }
}
