import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';

export async function GET(request: Request) {
  try {
    const auth = request.headers.get('authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    let payload: any;
    try { payload = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret'); }
    catch { return NextResponse.json({ message: 'Invalid token' }, { status: 401 }); }
    if (payload?.role !== 'SCHOOL') return NextResponse.json({ message: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('studentId');
    if (!studentId) return NextResponse.json({ message: 'studentId required' }, { status: 400 });

    const emptySlots = { slotA: false, slotB: false, rejectedA: false, rejectedB: false, approvedCount: 0 };

    // Determine if web student or app user (use findFirst to avoid UUID format crash)
    const webStudent = await prisma.student.findFirst({
      where: { id: studentId },
      select: { id: true, allocation: { select: { schoolId: true } } },
    });

    let where: any;
    if (webStudent) {
      if (webStudent.allocation?.schoolId !== payload.id)
        return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
      where = { studentId };
    } else {
      const appUser = await prisma.appUser.findFirst({
        where: { id: studentId },
        select: { olympiadId: true },
      });
      // studentId might be an olympiadCode (assigned-only, no web/app user yet) — return empty slots
      if (!appUser?.olympiadId) {
        return NextResponse.json(emptySlots);
      }

      const alloc = await prisma.olympiadIdAllocation.findUnique({
        where: { code: appUser.olympiadId },
        select: { schoolId: true },
      });
      if (alloc?.schoolId !== payload.id)
        return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
      where = { appUserId: studentId };
    }

    // Fetch evaluation videos for this student
    const evalVideos = await prisma.video.findMany({
      where: { ...where, isEvaluation: true },
      select: { category: true, status: true },
    });

    // Cat A slot
    const catAVideos = evalVideos.filter(v =>
      v.category?.toLowerCase().includes('performing') ||
      v.category?.toLowerCase().includes('cat a') ||
      v.category === 'Cat A'
    );
    const catBVideos = evalVideos.filter(v =>
      v.category?.toLowerCase().includes('creative') ||
      v.category?.toLowerCase().includes('cat b') ||
      v.category === 'Cat B'
    );

    const slotA = catAVideos.some(v => v.status === 'PENDING' || v.status === 'APPROVED');
    const slotB = catBVideos.some(v => v.status === 'PENDING' || v.status === 'APPROVED');
    const rejectedA = catAVideos.some(v => v.status === 'REJECTED') && !slotA;
    const rejectedB = catBVideos.some(v => v.status === 'REJECTED') && !slotB;

    const approvedCount = evalVideos.filter(v => v.status === 'APPROVED').length;

    return NextResponse.json({ slotA, slotB, rejectedA, rejectedB, approvedCount });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
