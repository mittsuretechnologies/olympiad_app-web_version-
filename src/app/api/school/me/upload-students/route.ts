import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';

// Returns all students assigned to this school's olympiad IDs (for upload page).
// Does NOT require isVerified — school can upload on behalf of any assigned student.
export async function GET(request: Request) {
  try {
    const auth = request.headers.get('authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    let payload: any;
    try { payload = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret'); }
    catch { return NextResponse.json({ message: 'Invalid token' }, { status: 401 }); }
    if (payload?.role !== 'SCHOOL' || !payload?.id)
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });

    // All sent allocations for this school
    const allocations = await prisma.olympiadIdAllocation.findMany({
      where: { schoolId: payload.id, sentAt: { not: null } },
      orderBy: [{ className: 'asc' }, { assignedName: 'asc' }],
      select: {
        code: true,
        classCode: true,
        className: true,
        assignedName: true,
        student: { select: { id: true, name: true } },
      },
    });

    // App users for these codes (to get their DB id for slot checks)
    const codes = allocations.map(a => a.code);
    const appUsers = await prisma.appUser.findMany({
      where: { olympiadId: { in: codes } },
      select: { id: true, userId: true, olympiadId: true },
    });
    const appUserByCode = new Map(appUsers.map(u => [u.olympiadId!, u]));

    const result = allocations
      .map(a => {
        const webStudent = a.student;
        const appUser = appUserByCode.get(a.code);

        // Skip assigned-only — no DB record to attach video to
        if (!webStudent && !appUser) return null;

        const id = webStudent?.id || appUser!.id;
        const name = a.assignedName || webStudent?.name || appUser!.userId;
        const source = webStudent ? 'web' : 'app';

        return { id, name, olympiadCode: a.code, classCode: a.classCode, className: a.className, source };
      })
      .filter(Boolean);

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
