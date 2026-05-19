import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const identifier: string = (body.identifier ?? body.email ?? body.username ?? '').trim();
    const password: string = body.password ?? '';

    if (!identifier || !password) {
      return NextResponse.json(
        { message: 'Username/email and password are required' },
        { status: 400 }
      );
    }

    // 1) Try SuperAdmin (by email)
    if (identifier.includes('@')) {
      const admin = await prisma.superAdmin.findUnique({
        where: { email: identifier },
      });
      if (admin) {
        const ok = await bcrypt.compare(password, admin.password);
        if (!ok) {
          return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 });
        }
        const token = jwt.sign(
          { id: admin.id, email: admin.email, role: 'SUPERADMIN' },
          process.env.JWT_SECRET || 'fallback_secret',
          { expiresIn: '1d' }
        );
        return NextResponse.json({
          message: 'Login successful',
          token,
          role: 'SUPERADMIN',
          redirect: '/dashboard',
          user: { id: admin.id, email: admin.email, name: admin.name },
        });
      }
    }

    // 2) Try School (by username = schoolId)
    const school = await prisma.school.findUnique({
      where: { username: identifier },
    });
    if (school && school.password) {
      const ok = await bcrypt.compare(password, school.password);
      if (!ok) {
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
        role: 'SCHOOL',
        redirect: '/school',
        user: {
          id: school.id,
          schoolId: school.schoolId,
          name: school.name,
          contactPerson: school.contactPerson,
        },
      });
    }

    return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
