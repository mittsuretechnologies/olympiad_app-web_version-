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

    // Fetch all sent allocations for this school
    const allocations = await prisma.olympiadIdAllocation.findMany({
      where: { schoolId: payload.id, sentAt: { not: null } },
      select: { code: true, classCode: true, className: true },
    });
    const codes = allocations.map((a: any) => a.code);
    const allocationByCode = new Map(allocations.map((a: any) => [a.code, a]));

    // Web-registered students (Student table)
    const webStudents = await prisma.student.findMany({
      where: { allocation: { schoolId: payload.id }, isVerified: true },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, name: true, phone: true, olympiadCode: true,
        isVerified: true, createdAt: true,
        allocation: { select: { classCode: true, className: true } },
      },
    });
    const webCodes = new Set(webStudents.map((s: any) => s.olympiadCode));

    // App-registered users (AppUser table) — those not already in Student table
    const appUsers = await prisma.appUser.findMany({
      where: { olympiadId: { in: codes }, isVerified: true },
      select: { id: true, userId: true, mobile: true, olympiadId: true, isVerified: true, createdAt: true },
    });

    const result = [
      ...webStudents.map((s: any) => ({
        id: s.id,
        name: s.name,
        phone: s.phone,
        olympiadCode: s.olympiadCode,
        isVerified: s.isVerified,
        createdAt: s.createdAt,
        classCode: s.allocation?.classCode || null,
        className: s.allocation?.className || null,
        source: 'web',
      })),
      ...appUsers
        .filter((u: any) => !webCodes.has(u.olympiadId))
        .map((u: any) => {
          const alloc = allocationByCode.get(u.olympiadId) as any;
          return {
            id: u.id,
            name: u.userId,
            phone: u.mobile || '-',
            olympiadCode: u.olympiadId,
            isVerified: u.isVerified,
            createdAt: u.createdAt,
            classCode: alloc?.classCode || null,
            className: alloc?.className || null,
            source: 'app',
          };
        }),
    ].sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json(result);
  } catch (error) {
    console.error('GET school registered-students failed:', error);
    return NextResponse.json({ message: 'Failed to fetch students' }, { status: 500 });
  }
}
