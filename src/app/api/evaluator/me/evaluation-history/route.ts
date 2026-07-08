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

    if (!['EVALUATOR', 'SUPERADMIN', 'REVIEWER'].includes(payload?.role) || !payload?.id) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    // Every evaluator/admin sees the full combined history for every student —
    // scores from other evaluators on the same student's other video must not be hidden.
    const evaluations = await prisma.videoEvaluation.findMany({
      include: {
        video: {
          include: {
            student: {
              select: {
                id: true, name: true, olympiadCode: true,
                allocation: { select: { className: true, classCode: true, assignedName: true, school: { select: { name: true } } } },
              },
            },
          },
        },
        evaluator: { select: { name: true, evaluatorId: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const appUserIds = [...new Set(evaluations.map(e => e.video.appUserId).filter(Boolean) as string[])];
    const appUsers = appUserIds.length
      ? await prisma.appUser.findMany({ where: { id: { in: appUserIds } }, select: { id: true, userId: true, olympiadId: true } })
      : [];
    const appUserById = new Map(appUsers.map(u => [u.id, u]));

    const appOlympiadCodes = appUsers.map(u => u.olympiadId).filter(Boolean) as string[];
    const appAllocations = appOlympiadCodes.length
      ? await prisma.olympiadIdAllocation.findMany({
          where: { code: { in: appOlympiadCodes } },
          select: { code: true, className: true, classCode: true, assignedName: true, school: { select: { name: true } } },
        })
      : [];
    const allocByCode = new Map(appAllocations.map(a => [a.code, a]));

    const groupMap = new Map<string, {
      studentKey: string;
      studentName: string;
      username: string | null;
      olympiadCode: string;
      className: string | null;
      schoolName: string | null;
      videos: {
        id: string;
        videoId: string;
        videoUrl: string;
        thumbnailUrl: string | null;
        category: string;
        subCategory: string;
        confidenceScore: number;
        creativityScore: number;
        techniqueScore: number;
        presentationScore: number;
        totalScore: number;
        remarks: string | null;
        createdAt: Date;
        isPublished: boolean;
        publishedAt: Date | null;
        evaluatorName: string;
        evaluatorId: string;
      }[];
    }>();

    for (const e of evaluations) {
      const v = e.video;
      let key: string;
      let studentName: string;
      let username: string | null = null;
      let olympiadCode: string;
      let className: string | null = null;
      let schoolName: string | null = null;

      if (v.studentId && v.student) {
        key = v.studentId;
        studentName = v.student.allocation?.assignedName || v.student.name;
        olympiadCode = v.student.olympiadCode;
        className = v.student.allocation?.className || v.student.allocation?.classCode || null;
        schoolName = v.student.allocation?.school?.name || null;
      } else if (v.appUserId) {
        key = v.appUserId;
        const appUser = appUserById.get(v.appUserId);
        const alloc = appUser?.olympiadId ? allocByCode.get(appUser.olympiadId) : null;
        studentName = alloc?.assignedName || appUser?.userId || '-';
        username = appUser?.userId || null;
        olympiadCode = appUser?.olympiadId || '-';
        className = alloc?.className || alloc?.classCode || null;
        schoolName = alloc?.school?.name || null;
      } else {
        continue;
      }

      const videoEntry = {
        id: e.id,
        videoId: e.videoId,
        videoUrl: v.videoUrl,
        thumbnailUrl: v.thumbnailUrl,
        category: v.category || '',
        subCategory: v.subCategory || '',
        confidenceScore: e.confidenceScore,
        creativityScore: e.creativityScore,
        techniqueScore: e.techniqueScore,
        presentationScore: e.presentationScore,
        totalScore: e.totalScore,
        remarks: e.remarks,
        createdAt: e.createdAt,
        isPublished: e.isPublished,
        publishedAt: e.publishedAt,
        evaluatorName: e.evaluator?.name || '-',
        evaluatorId: e.evaluatorId,
      };

      if (!groupMap.has(key)) {
        groupMap.set(key, { studentKey: key, studentName, username, olympiadCode, className, schoolName, videos: [videoEntry] });
      } else {
        groupMap.get(key)!.videos.push(videoEntry);
      }
    }

    const result = Array.from(groupMap.values()).map(g => ({
      ...g,
      videoCount: g.videos.length,
      combinedScore: g.videos.reduce((sum, v) => sum + v.totalScore, 0),
      combinedMaxScore: g.videos.length * 20,
      allPublished: g.videos.length > 0 && g.videos.every(v => v.isPublished),
    }));

    result.sort((a, b) => new Date(b.videos[0].createdAt).getTime() - new Date(a.videos[0].createdAt).getTime());

    return NextResponse.json(result);
  } catch (error) {
    console.error('GET evaluator/me/evaluation-history failed:', error);
    return NextResponse.json({ message: 'Failed to fetch history' }, { status: 500 });
  }
}
