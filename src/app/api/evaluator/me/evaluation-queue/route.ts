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

    // Real evaluators use this to work their queue; SuperAdmin/Reviewer get
    // read-only visibility into the same queue for oversight purposes.
    if (!['EVALUATOR', 'SUPERADMIN', 'REVIEWER'].includes(payload?.role) || !payload?.id) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    // 1. Olympiad-evaluation videos uploaded by web-registered Students, approved, not yet scored
    const studentVideos = await prisma.video.findMany({
      where: {
        isEvaluation: true,
        status: 'APPROVED',
        evaluation: null,
        studentId: { not: null },
      },
      include: {
        student: {
          select: {
            id: true, name: true, olympiadCode: true,
            allocation: { select: { classCode: true, className: true, school: { select: { name: true } } } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // 2. Olympiad-evaluation videos uploaded by app users, approved, not yet scored
    const appVideos = await prisma.video.findMany({
      where: {
        isEvaluation: true,
        status: 'APPROVED',
        evaluation: null,
        appUserId: { not: null },
      },
      orderBy: { createdAt: 'asc' },
    });
    const appUserIds = appVideos.map(v => v.appUserId!).filter(Boolean);
    const appUsers = await prisma.appUser.findMany({
      where: { id: { in: appUserIds } },
      select: { id: true, userId: true, olympiadId: true },
    });
    const appUserById = new Map(appUsers.map(u => [u.id, u]));

    const olympiadCodes = appUsers.map(u => u.olympiadId).filter(Boolean) as string[];
    const allocations = await prisma.olympiadIdAllocation.findMany({
      where: { code: { in: olympiadCodes } },
      select: { code: true, classCode: true, className: true, school: { select: { name: true } } },
    });
    const allocByCode = new Map(allocations.map(a => [a.code, a]));

    const queue = [
      ...studentVideos.map(v => ({
        id: v.id,
        videoUrl: v.videoUrl,
        thumbnailUrl: v.thumbnailUrl || null,
        caption: v.caption || '',
        category: v.category || '',
        subCategory: v.subCategory || '',
        createdAt: v.createdAt,
        studentName: v.student?.name || '-',
        olympiadCode: v.student?.olympiadCode || '-',
        className: v.student?.allocation?.className || v.student?.allocation?.classCode || null,
        schoolName: v.student?.allocation?.school?.name || null,
      })),
      ...appVideos.map(v => {
        const u = appUserById.get(v.appUserId!);
        const alloc = u?.olympiadId ? allocByCode.get(u.olympiadId) : null;
        return {
          id: v.id,
          videoUrl: v.videoUrl,
          thumbnailUrl: v.thumbnailUrl || null,
          caption: v.caption || '',
          category: v.category || '',
          subCategory: v.subCategory || '',
          createdAt: v.createdAt,
          studentName: u?.userId || '-',
          olympiadCode: u?.olympiadId || '-',
          className: alloc?.className || alloc?.classCode || null,
          schoolName: alloc?.school?.name || null,
        };
      }),
    ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    return NextResponse.json(queue);
  } catch (error) {
    console.error('GET evaluator/me/evaluation-queue failed:', error);
    return NextResponse.json({ message: 'Failed to fetch queue' }, { status: 500 });
  }
}
