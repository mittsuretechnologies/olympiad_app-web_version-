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

    const allocations = await prisma.olympiadIdAllocation.findMany({
      where: { schoolId: payload.id, sentAt: { not: null } },
      include: {
        student: {
          select: { id: true, name: true, isVerified: true, createdAt: true },
        },
      },
      orderBy: [{ prefix: 'asc' }, { sequence: 'asc' }],
    });

    // Also fetch AppUsers who registered via mobile app using these olympiad codes
    const codes = allocations.map(a => a.code);
    const appUsers = await prisma.appUser.findMany({
      where: { olympiadId: { in: codes }, isVerified: true },
      select: { id: true, userId: true, olympiadId: true, isVerified: true, createdAt: true },
    });
    const appUserByCode = new Map(appUsers.map(u => [u.olympiadId, u]));

    const totalAllocated = allocations.length;
    const totalRegistered = allocations.filter(a => a.student !== null || appUserByCode.has(a.code)).length;
    const totalPending = totalAllocated - totalRegistered;
    const registrationRate = totalAllocated > 0 ? Math.round((totalRegistered / totalAllocated) * 100) : 0;

    // Class-wise breakdown
    const classMap = new Map<string, { className: string; classCode: string; allocated: number; registered: number }>();
    for (const a of allocations) {
      const key = a.classCode || 'UNKNOWN';
      const label = a.className || a.classCode || 'Unknown';
      if (!classMap.has(key)) {
        classMap.set(key, { className: label, classCode: key, allocated: 0, registered: 0 });
      }
      const entry = classMap.get(key)!;
      entry.allocated += 1;
      if (a.student || appUserByCode.has(a.code)) entry.registered += 1;
    }

    const classwiseBreakdown = Array.from(classMap.values())
      .map(c => ({
        ...c,
        pending: c.allocated - c.registered,
        rate: c.allocated > 0 ? Math.round((c.registered / c.allocated) * 100) : 0,
      }))
      .sort((a, b) => a.className.localeCompare(b.className));

    // Recent registrations (last 5) — merge Student + AppUser
    const recentList: { studentName: string; olympiadCode: string; className: string; registeredAt: Date }[] = [];
    for (const a of allocations) {
      if (a.student) {
        recentList.push({ studentName: a.student.name, olympiadCode: a.code, className: a.className || a.classCode || '-', registeredAt: a.student.createdAt });
      } else if (appUserByCode.has(a.code)) {
        const u = appUserByCode.get(a.code)!;
        recentList.push({ studentName: u.userId, olympiadCode: a.code, className: a.className || a.classCode || '-', registeredAt: u.createdAt });
      }
    }
    const recentRegistrations = recentList
      .sort((a, b) => new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime())
      .slice(0, 5)
      .map(r => ({ ...r, registeredAt: r.registeredAt.toISOString() }));

    return NextResponse.json({
      totalAllocated,
      totalRegistered,
      totalPending,
      registrationRate,
      classwiseBreakdown,
      recentRegistrations,
    });
  } catch (error) {
    console.error('GET school/me/stats failed:', error);
    return NextResponse.json({ message: 'Failed to fetch stats' }, { status: 500 });
  }
}
