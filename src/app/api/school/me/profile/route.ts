import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
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

    if (payload?.role !== 'SCHOOL' || !payload?.id) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const school = await prisma.school.findUnique({
      where: { id: payload.id },
      select: {
        id: true,
        schoolId: true,
        olympiadId: true,
        name: true,
        address: true,
        email: true,
        phone: true,
        contactPerson: true,
        city: true,
        district: true,
        state: true,
        pincode: true,
        isActive: true,
        createdAt: true,
      },
    });

    if (!school) return NextResponse.json({ message: 'School not found' }, { status: 404 });

    return NextResponse.json(school);
  } catch (error) {
    console.error('GET school/me/profile failed:', error);
    return NextResponse.json({ message: 'Failed to fetch profile' }, { status: 500 });
  }
}
