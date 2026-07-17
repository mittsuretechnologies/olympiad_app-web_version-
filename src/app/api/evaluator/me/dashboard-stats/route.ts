import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { requireModule } from '@/lib/auth-guard';

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
    // Reviewer/SuperAdmin are oversight roles with unconditional access here;
    // only Evaluator is gated by the evaluator.content module permission.
    if (isEvaluator) {
      const moduleCheck = await requireModule(payload, 'evaluator.content');
      if (moduleCheck.error) return moduleCheck.error;
    }
    const filter = isEvaluator ? { evaluatorId: payload.id } : {};

    // Evaluators can be scoped to specific states by code (see TalentEvaluator
    // .assignedStates, e.g. ["RJ", "GJ"]). Empty array = unrestricted.
    // SuperAdmin/Reviewer always see everything (oversight roles).
    let regionFilter: string[] | null = null;
    if (isEvaluator) {
      const evaluator = await prisma.talentEvaluator.findUnique({
        where: { id: payload.id },
        select: { assignedStates: true },
      });
      if (evaluator && evaluator.assignedStates.length > 0) {
        regionFilter = evaluator.assignedStates;
      }
    }

    // Get stats from evaluations
    const [evaluationsCount, scoreAggregates, recentEvaluations, approvedVideos] = await Promise.all([
      // 1. Total evaluated count (kosh rows, not videos)
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
      // 4. All approved evaluation videos with their kosh count, to derive pending (< 2 koshas scored)
      prisma.video.findMany({
        where: { isEvaluation: true, status: 'APPROVED', deletedAt: null, OR: [{ studentId: { not: null } }, { appUserId: { not: null } }] },
        select: {
          id: true,
          appUserId: true,
          _count: { select: { evaluations: true } },
          student: { select: { allocation: { select: { school: { select: { stateCode: true } } } } } },
        },
      }),
    ]);

    let regionScopedApproved = approvedVideos;
    if (regionFilter) {
      const appUserIds2 = [...new Set(approvedVideos.filter(v => v.appUserId).map(v => v.appUserId!))];
      const appUsers2 = appUserIds2.length
        ? await prisma.appUser.findMany({ where: { id: { in: appUserIds2 } }, select: { id: true, olympiadId: true } })
        : [];
      const appUserById2 = new Map(appUsers2.map(u => [u.id, u]));
      const appOlympiadCodes2 = appUsers2.map(u => u.olympiadId).filter(Boolean) as string[];
      const appAllocations2 = appOlympiadCodes2.length
        ? await prisma.olympiadIdAllocation.findMany({
            where: { code: { in: appOlympiadCodes2 } },
            select: { code: true, school: { select: { stateCode: true } } },
          })
        : [];
      const allocByCode2 = new Map(appAllocations2.map(a => [a.code, a]));

      regionScopedApproved = approvedVideos.filter(v => {
        let stateCode: string | null = null;
        if (v.student) {
          stateCode = v.student.allocation?.school?.stateCode ?? null;
        } else if (v.appUserId) {
          const appUser = appUserById2.get(v.appUserId);
          const alloc = appUser?.olympiadId ? allocByCode2.get(appUser.olympiadId) : null;
          stateCode = alloc?.school?.stateCode ?? null;
        }
        return stateCode !== null && regionFilter!.includes(stateCode);
      });
    }
    const pendingQueue = regionScopedApproved.filter(v => v._count.evaluations < 2).length;

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

    return NextResponse.json({
      stats: {
        totalEvaluated: evaluationsCount,
        averageScore: scoreAggregates._avg.totalScore ? Math.round(scoreAggregates._avg.totalScore * 10) / 10 : 0,
        pendingQueue: pendingQueue,
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
