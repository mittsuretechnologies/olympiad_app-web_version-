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

    const isEvaluator = payload.role === 'EVALUATOR';
    const filter = isEvaluator ? { evaluatorId: payload.id } : {};

    // Get stats from evaluations
    const [evaluationsCount, scoreAggregates, recentEvaluations, pendingStudentCount, pendingAppUserCount] = await Promise.all([
      // 1. Total evaluated count
      prisma.videoEvaluation.count({
        where: filter,
      }),
      // 2. Score aggregates (average of each criteria)
      prisma.videoEvaluation.aggregate({
        where: filter,
        _avg: {
          confidenceScore: true,
          creativityScore: true,
          techniqueScore: true,
          presentationScore: true,
          totalScore: true,
        },
      }),
      // 3. Recent 5 evaluations
      prisma.videoEvaluation.findMany({
        where: filter,
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          video: {
            include: {
              student: {
                select: {
                  name: true, olympiadCode: true,
                  allocation: { select: { assignedName: true } },
                },
              },
            },
          },
        },
      }),
      // 4. Pending queue count (student videos)
      prisma.video.count({
        where: {
          isEvaluation: true,
          status: 'APPROVED',
          evaluation: null,
          studentId: { not: null },
        },
      }),
      // 5. Pending queue count (app user videos)
      prisma.video.count({
        where: {
          isEvaluation: true,
          status: 'APPROVED',
          evaluation: null,
          appUserId: { not: null },
        },
      }),
    ]);

    // Resolve app user details for recent evaluations if they were uploaded by app users
    const appUserIds = recentEvaluations
      .map(e => e.video.appUserId)
      .filter(Boolean) as string[];

    const appUsers = appUserIds.length > 0
      ? await prisma.appUser.findMany({
          where: { id: { in: appUserIds } },
          select: { id: true, userId: true, olympiadId: true },
        })
      : [];

    const appUserById = new Map(appUsers.map(u => [u.id, u]));

    const appOlympiadCodes = appUsers.map(u => u.olympiadId).filter(Boolean) as string[];
    const appAllocations = appOlympiadCodes.length > 0
      ? await prisma.olympiadIdAllocation.findMany({
          where: { code: { in: appOlympiadCodes } },
          select: { code: true, assignedName: true },
        })
      : [];
    const allocByCode = new Map(appAllocations.map(a => [a.code, a]));

    const formattedRecent = recentEvaluations.map(e => {
      const appUser = appUserById.get(e.video.appUserId || '');
      const appAlloc = appUser?.olympiadId ? allocByCode.get(appUser.olympiadId) : null;
      return {
        id: e.id,
        videoId: e.videoId,
        videoUrl: e.video.videoUrl,
        thumbnailUrl: e.video.thumbnailUrl,
        category: e.video.category,
        subCategory: e.video.subCategory,
        studentName: e.video.student?.allocation?.assignedName || e.video.student?.name || appAlloc?.assignedName || appUser?.userId || '-',
        olympiadCode: e.video.student?.olympiadCode || appUser?.olympiadId || '-',
        totalScore: e.totalScore,
        createdAt: e.createdAt,
      };
    });

    const totalPending = pendingStudentCount + pendingAppUserCount;

    return NextResponse.json({
      stats: {
        totalEvaluated: evaluationsCount,
        averageScore: scoreAggregates._avg.totalScore ? Math.round(scoreAggregates._avg.totalScore * 10) / 10 : 0,
        pendingQueue: totalPending,
      },
      criteriaAvg: {
        confidenceScore: scoreAggregates._avg.confidenceScore ? Math.round(scoreAggregates._avg.confidenceScore * 10) / 10 : 0,
        creativityScore: scoreAggregates._avg.creativityScore ? Math.round(scoreAggregates._avg.creativityScore * 10) / 10 : 0,
        techniqueScore: scoreAggregates._avg.techniqueScore ? Math.round(scoreAggregates._avg.techniqueScore * 10) / 10 : 0,
        presentationScore: scoreAggregates._avg.presentationScore ? Math.round(scoreAggregates._avg.presentationScore * 10) / 10 : 0,
      },
      recentEvaluations: formattedRecent,
    });
  } catch (error) {
    console.error('GET evaluator/me/dashboard-stats failed:', error);
    return NextResponse.json({ message: 'Failed to fetch dashboard stats' }, { status: 500 });
  }
}
