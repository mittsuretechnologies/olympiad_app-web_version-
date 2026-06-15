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
      select: { code: true, classCode: true, className: true, assignedName: true },
    });
    const codes = allocations.map(a => a.code);
    const allocationByCode = new Map(allocations.map(a => [a.code, a]));

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
    const webCodes = new Set(webStudents.map(s => s.olympiadCode));

    // App-registered users (AppUser table) — only those not already in Student table
    const appUsers = await prisma.appUser.findMany({
      where: { olympiadId: { in: codes }, isVerified: true },
      select: { id: true, userId: true, mobile: true, olympiadId: true, isVerified: true, createdAt: true },
    });

    // Olympiad video counts — web students (studentId) + app users (appUserId)
    const webStudentIds = webStudents.map(s => s.id);
    const appUserIds    = appUsers.filter(u => !webCodes.has(u.olympiadId!)).map(u => u.id);

    const [webVideoCounts, appVideoCounts] = await Promise.all([
      prisma.video.groupBy({
        by: ['studentId'],
        where: { studentId: { in: webStudentIds }, isEvaluation: true, status: 'APPROVED' },
        _count: { id: true },
      }),
      prisma.video.groupBy({
        by: ['appUserId'],
        where: { appUserId: { in: appUserIds }, isEvaluation: true, status: 'APPROVED' },
        _count: { id: true },
      }),
    ]);

    const webVideoCountById  = new Map(webVideoCounts.map((r: any) => [r.studentId, r._count.id]));
    const appVideoCountById  = new Map(appVideoCounts.map((r: any) => [r.appUserId,  r._count.id]));

    const result = [
      ...webStudents.map(s => ({
        id: s.id,
        name: s.name,
        phone: s.phone,
        olympiadCode: s.olympiadCode,
        isVerified: s.isVerified,
        createdAt: s.createdAt,
        classCode: s.allocation?.classCode || null,
        className: s.allocation?.className || null,
        source: 'web' as const,
        olympiadVideos: webVideoCountById.get(s.id) || 0,
      })),
      ...appUsers
        .filter(u => !webCodes.has(u.olympiadId!))
        .map(u => {
          const alloc = allocationByCode.get(u.olympiadId!);
          return {
            id: u.id,
            name: (allocationByCode.get(u.olympiadId!) as any)?.assignedName || u.userId,
            phone: u.mobile || '-',
            olympiadCode: u.olympiadId!,
            isVerified: u.isVerified,
            createdAt: u.createdAt,
            classCode: alloc?.classCode || null,
            className: alloc?.className || null,
            source: 'app' as const,
            olympiadVideos: appVideoCountById.get(u.id) || 0,
          };
        }),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json(result);
  } catch (error) {
    console.error('GET school registered-students failed:', error);
    return NextResponse.json({ message: 'Failed to fetch students' }, { status: 500 });
  }
}
