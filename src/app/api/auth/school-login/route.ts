import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { message: 'Username and password are required' },
        { status: 400 }
      );
    }

    const school = await prisma.school.findUnique({
      where: { username },
    });

    if (!school || !school.password) {
      return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, school.password);
    if (!valid) {
      return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 });
    }

    const token = jwt.sign(
      { id: school.id, schoolId: school.schoolId, role: 'SCHOOL' },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '1d' }
    );

    return NextResponse.json({
      message: 'Login successful',
      token,
      user: {
        id: school.id,
        schoolId: school.schoolId,
        name: school.name,
        contactPerson: school.contactPerson,
      },
    });
  } catch (error) {
    console.error('School login error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
