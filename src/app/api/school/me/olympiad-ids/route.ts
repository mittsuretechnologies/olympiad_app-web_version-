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

    const allocations = await prisma.olympiadIdAllocation.findMany({
      where: { schoolId: payload.id, sentAt: { not: null } },
      orderBy: [{ prefix: 'asc' }, { sequence: 'asc' }],
      select: {
        id: true, code: true, classCode: true, className: true,
        sentAt: true, createdAt: true, assignedName: true, assignedAt: true,
        student: { select: { name: true, isVerified: true } },
      },
    });

    // Check which codes have an AppUser registered
    const codes = allocations.map(a => a.code);
    const appUsers = await prisma.appUser.findMany({
      where: { olympiadId: { in: codes } },
      select: { olympiadId: true, mobile: true },
    });
    const appUserByCode = new Map(appUsers.map(u => [u.olympiadId!, u]));

    const result = allocations.map(a => ({
      ...a,
      hasAppUser: appUserByCode.has(a.code),
      appUserPhone: appUserByCode.get(a.code)?.mobile ?? null,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('GET school olympiad-ids failed:', error);
    return NextResponse.json({ message: 'Failed to fetch IDs' }, { status: 500 });
  }
}
