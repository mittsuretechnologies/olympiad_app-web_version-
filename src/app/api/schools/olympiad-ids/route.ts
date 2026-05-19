import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const ids = await prisma.olympiadIdAllocation.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        school: {
          select: { schoolId: true, name: true, city: true, state: true },
        },
        student: {
          select: { name: true, phone: true, createdAt: true },
        },
      },
    });
    return NextResponse.json(ids);
  } catch (error) {
    console.error('GET /api/schools/olympiad-ids failed:', error);
    return NextResponse.json({ message: 'Failed to fetch' }, { status: 500 });
  }
}
