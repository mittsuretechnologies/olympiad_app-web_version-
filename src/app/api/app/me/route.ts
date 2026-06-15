import { NextResponse } from 'next/server';
import { verify } from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

function getAppUserFromToken(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  try {
    const decoded = verify(token, JWT_SECRET) as any;
    if (decoded.role !== 'APP_USER') return null;
    return decoded;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const appUser = getAppUserFromToken(request);
  if (!appUser) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const user = await prisma.appUser.findUnique({
      where: { id: appUser.id },
      select: {
        id: true,
        userId: true,
        email: true,
        mobile: true,
        avatarUrl: true,
        olympiadId: true,
        isVerified: true,
        termsAccepted: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    // If user has an olympiadId, resolve the linked school and student name
    // Prefer Student.name, fall back to allocation.assignedName (set by school admin)
    let school: { name: string | null; state: string | null; district: string | null; schoolId: string } | null = null;
    let studentName: string | null = null;
    if (user.olympiadId) {
      const allocation = await prisma.olympiadIdAllocation.findUnique({
        where:  { code: user.olympiadId },
        select: {
          assignedName: true,
          school:  { select: { name: true, state: true, district: true, schoolId: true } },
          student: { select: { name: true } },
        },
      });
      if (allocation?.school) school = allocation.school;
      studentName = allocation?.student?.name ?? allocation?.assignedName ?? null;
    }

    return NextResponse.json({ user, school, studentName });
  } catch (error: any) {
    console.error('app/me error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
