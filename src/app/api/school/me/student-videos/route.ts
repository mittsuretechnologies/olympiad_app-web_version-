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

    // Get all allocations for this school
    const allocations = await prisma.olympiadIdAllocation.findMany({
      where: { schoolId: payload.id, sentAt: { not: null } },
      select: { code: true, classCode: true, className: true, assignedName: true },
    });
    const codes = allocations.map((a: any) => a.code);
    const allocByCode = new Map(allocations.map((a: any) => [a.code, a]));

    // 1. Videos from web-registered Students
    const studentVideos = await prisma.video.findMany({
      where: {
        status: 'APPROVED',
        deletedAt: null,
        student: { allocation: { schoolId: payload.id } },
      },
      include: {
        student: {
          select: {
            id: true, name: true, olympiadCode: true,
            allocation: { select: { classCode: true, className: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // 2. Videos from app-registered AppUsers (linked via olympiadId)
    const appUsers = await prisma.appUser.findMany({
      where: { olympiadId: { in: codes }, isVerified: true },
      select: { id: true, userId: true, olympiadId: true },
    });
    const appUserById = new Map(appUsers.map((u: any) => [u.id, u]));
    const appUserIds = appUsers.map((u: any) => u.id);

    const appVideos = await prisma.video.findMany({
      where: { appUserId: { in: appUserIds }, status: 'APPROVED', deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    // Merge and normalise
    const result = [
      ...studentVideos.map((v: any) => ({
        id: v.id,
        videoUrl: v.videoUrl,
        thumbnailUrl: v.thumbnailUrl || null,
        caption: v.caption || '',
        category: v.category || '',
        subCategory: v.subCategory || '',
        tags: v.tags || '',
        isEvaluation: v.isEvaluation,
        uploaderType: v.uploaderType,
        status: v.status,
        rejectionReason: v.rejectionReason || null,
        likesCount: v.likesCount,
        viewsCount: v.viewsCount,
        createdAt: v.createdAt,
        studentName: v.student?.name || '-',
        username: null,
        studentId: v.student?.id || null,
        olympiadCode: v.student?.olympiadCode || '-',
        classCode: v.student?.allocation?.classCode || null,
        className: v.student?.allocation?.className || null,
        source: 'web',
      })),
      ...appVideos.map((v: any) => {
        const u = appUserById.get(v.appUserId);
        const alloc = u ? allocByCode.get(u.olympiadId) as any : null;
        return {
          id: v.id,
          videoUrl: v.videoUrl,
          thumbnailUrl: v.thumbnailUrl || null,
          caption: v.caption || '',
          category: v.category || '',
          subCategory: v.subCategory || '',
          tags: v.tags || '',
          isEvaluation: v.isEvaluation,
          uploaderType: v.uploaderType,
          status: v.status,
          rejectionReason: v.rejectionReason || null,
          likesCount: v.likesCount,
          viewsCount: v.viewsCount,
          createdAt: v.createdAt,
          studentName: alloc?.assignedName || u?.userId || '-',
          username: u?.userId || null,
          studentId: u?.id || null,
          olympiadCode: u?.olympiadId || '-',
          classCode: alloc?.classCode || null,
          className: alloc?.className || null,
          source: 'app',
        };
      }),
    ].sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json(result);
  } catch (error) {
    console.error('GET school/me/student-videos failed:', error);
    return NextResponse.json({ message: 'Failed to fetch videos' }, { status: 500 });
  }
}
