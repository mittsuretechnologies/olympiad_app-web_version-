import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const auth = request.headers.get('authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    let payload: any;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    } catch {
      return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
    }

    if (payload?.role !== 'SCHOOL' || !payload?.id) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    // Fetch students through allocations belonging to this school
    const students = await prisma.student.findMany({
      where: {
        allocation: {
          schoolId: payload.id
        },
        isVerified: true
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        phone: true,
        olympiadCode: true,
        isVerified: true,
        createdAt: true,
      }
    });

    return NextResponse.json(students);
  } catch (error) {
    console.error('GET school registered-students failed:', error);
    return NextResponse.json({ message: 'Failed to fetch students' }, { status: 500 });
  }
}
