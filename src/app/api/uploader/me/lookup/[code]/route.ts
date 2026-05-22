import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const auth = request.headers.get('authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    let payload: any;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    } catch {
      return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
    }

    if (payload?.role !== 'UPLOADER') {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const { code } = await params;
    const cleanCode = code.trim();

    const allocation = await prisma.olympiadIdAllocation.findUnique({
      where: { code: cleanCode },
      include: {
        school: {
          select: {
            id: true,
            schoolId: true,
            name: true,
            city: true,
            state: true,
          },
        },
        student: true,
      },
    });

    if (!allocation) {
      return NextResponse.json({ message: 'Olympiad ID not found' }, { status: 404 });
    }

    if (!allocation.student) {
      return NextResponse.json(
        { message: 'This Olympiad ID has not been registered by a student yet.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      code: allocation.code,
      studentName: allocation.student.name,
      studentPhone: allocation.student.phone,
      registeredAt: allocation.student.createdAt,
      school: allocation.school,
    });
  } catch (error) {
    console.error('GET uploader/me/lookup/[code] failed:', error);
    return NextResponse.json({ message: 'Failed to lookup' }, { status: 500 });
  }
}
