import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { getJwtSecret } from '@/lib/jwt-secret';

// Passwords are never sent to the school panel — not even decrypted for display.
// The list only says whether a password exists (`hasPassword`); the one time a
// school sees a password is in the reset response, so it can pass it on.

export async function GET(request: Request) {
  try {
    const auth = request.headers.get('authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    let payload: any;
    try { payload = jwt.verify(token, getJwtSecret()); }
    catch { return NextResponse.json({ message: 'Invalid token' }, { status: 401 }); }
    if (payload?.role !== 'SCHOOL' || !payload?.id)
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });

    const allocations = await prisma.olympiadIdAllocation.findMany({
      where: { schoolId: payload.id, sentAt: { not: null } },
      orderBy: [{ prefix: 'asc' }, { sequence: 'asc' }],
      select: {
        id: true, code: true, classCode: true, className: true, assignedName: true,
        student: {
          select: {
            id: true, name: true, phone: true,
            username: true, plainPassword: true,
            isVerified: true, createdAt: true,
          },
        },
      },
    });

    const codes = allocations.map(a => a.code);
    const appUsers = await prisma.appUser.findMany({
      where: { olympiadId: { in: codes } },
      select: {
        id: true, userId: true, mobile: true, email: true,
        olympiadId: true, isVerified: true, createdAt: true,
        plainPassword: true,
      },
    });
    const appUserByCode = new Map(appUsers.map(u => [u.olympiadId, u]));

    const result = allocations.map(a => {
      if (a.student) {
        return {
          id: a.id,
          code: a.code,
          classCode: a.classCode,
          className: a.className,
          student: {
            id: a.student.id,
            name: a.student.name,
            phone: a.student.phone,
            username: a.student.username,
            hasPassword: Boolean(a.student.plainPassword),
            isVerified: a.student.isVerified,
            createdAt: a.student.createdAt,
            source: 'web' as const,
          },
        };
      }

      const appUser = appUserByCode.get(a.code);
      if (appUser) {
        return {
          id: a.id,
          code: a.code,
          classCode: a.classCode,
          className: a.className,
          student: {
            id: appUser.id,
            name: a.assignedName || appUser.userId,
            phone: appUser.mobile || '-',
            email: appUser.email || null,
            username: appUser.userId,
            hasPassword: Boolean(appUser.plainPassword),
            isVerified: appUser.isVerified,
            createdAt: appUser.createdAt,
            source: 'app' as const,
          },
        };
      }

      return { id: a.id, code: a.code, classCode: a.classCode, className: a.className, student: null };
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('GET school credentials failed:', error);
    return NextResponse.json({ message: 'Failed to fetch credentials' }, { status: 500 });
  }
}
