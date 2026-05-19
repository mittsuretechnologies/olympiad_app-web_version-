import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const { olympiadCode, password } = await request.json();

    if (!olympiadCode || !password) {
      return NextResponse.json(
        { message: 'Olympiad ID and password are required' },
        { status: 400 }
      );
    }

    const student = await prisma.student.findUnique({
      where: { olympiadCode: olympiadCode.trim() },
      include: {
        allocation: {
          include: {
            school: { select: { schoolId: true, name: true, city: true } },
          },
        },
      },
    });

    if (!student || !student.password) {
      return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 });
    }
    if (!student.isVerified) {
      return NextResponse.json({ message: 'Account not verified. Please complete registration.' }, { status: 401 });
    }

    const ok = await bcrypt.compare(password, student.password);
    if (!ok) {
      return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 });
    }

    const token = jwt.sign(
      { id: student.id, olympiadCode: student.olympiadCode, role: 'STUDENT' },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '30d' }
    );

    return NextResponse.json({
      message: 'Login successful',
      token,
      user: {
        id: student.id,
        name: student.name,
        olympiadCode: student.olympiadCode,
        phone: student.phone,
        school: student.allocation.school,
      },
    });
  } catch (error) {
    console.error('Student login error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
