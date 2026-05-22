import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret') as any;

    if (!decoded || decoded.role !== 'STUDENT') {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const student = await prisma.student.findUnique({
      where: { id: decoded.id },
      include: {
        allocation: {
          include: {
            school: {
              select: {
                name: true,
                city: true,
                schoolId: true,
              },
            },
          },
        },
      },
    });

    if (!student) {
      return NextResponse.json({ message: 'Student not found' }, { status: 404 });
    }

    return NextResponse.json({
      user: {
        id: student.id,
        name: student.name,
        olympiadCode: student.olympiadCode,
        phone: student.phone,
        school: student.allocation.school,
        isVerified: student.isVerified,
        createdAt: student.createdAt,
      },
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    return NextResponse.json({ message: 'Session expired' }, { status: 401 });
  }
}
