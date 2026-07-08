import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth-guard';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { error } = requireRole(request, ['SUPERADMIN', 'EVALUATOR', 'REVIEWER']);
  if (error) return error;
  try {
    // 1. Get all approved evaluation videos with their evaluation status
    const allVideos = await prisma.video.findMany({
      where: {
        isEvaluation: true,
        status: 'APPROVED',
      },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            olympiadCode: true,
            allocation: {
              select: {
                classCode: true,
                className: true,
                assignedName: true,
                school: {
                  select: { id: true, schoolId: true, name: true, city: true, state: true, district: true },
                },
              },
            },
          },
        },
        evaluation: {
          select: {
            id: true,
            confidenceScore: true,
            creativityScore: true,
            techniqueScore: true,
            presentationScore: true,
            totalScore: true,
            remarks: true,
            createdAt: true,
            evaluator: { select: { name: true, evaluatorId: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // 2. Resolve app user details for videos uploaded by app users
    const appUserIds = allVideos
      .filter(v => v.appUserId && !v.studentId)
      .map(v => v.appUserId!)
      .filter(Boolean);

    const uniqueAppUserIds = [...new Set(appUserIds)];

    const appUsers = uniqueAppUserIds.length > 0
      ? await prisma.appUser.findMany({
          where: { id: { in: uniqueAppUserIds } },
          select: { id: true, userId: true, olympiadId: true },
        })
      : [];
    const appUserById = new Map(appUsers.map(u => [u.id, u]));

    // Fetch allocations for app users' olympiad codes
    const appOlympiadCodes = appUsers.map(u => u.olympiadId).filter(Boolean) as string[];
    const appAllocations = appOlympiadCodes.length > 0
      ? await prisma.olympiadIdAllocation.findMany({
          where: { code: { in: appOlympiadCodes } },
          select: {
            code: true,
            classCode: true,
            className: true,
            assignedName: true,
            school: {
              select: { id: true, schoolId: true, name: true, city: true, state: true, district: true },
            },
          },
        })
      : [];
    const allocByCode = new Map(appAllocations.map(a => [a.code, a]));

    // 3. Group videos by student/user identifier
    // Key = studentId or appUserId
    const groupMap = new Map<string, {
      studentKey: string;
      name: string;
      olympiadCode: string;
      className: string | null;
      schoolName: string | null;
      schoolId: string | null;
      state: string | null;
      district: string | null;
      city: string | null;
      source: 'web' | 'app';
      videos: {
        id: string;
        videoUrl: string;
        thumbnailUrl: string | null;
        caption: string | null;
        category: string | null;
        subCategory: string | null;
        createdAt: Date;
        isEvaluated: boolean;
        evaluation: {
          totalScore: number;
          confidenceScore: number;
          creativityScore: number;
          techniqueScore: number;
          presentationScore: number;
          remarks: string | null;
          evaluatorName: string;
          evaluatedAt: Date;
        } | null;
      }[];
    }>();

    for (const v of allVideos) {
      let key: string;
      let name: string;
      let olympiadCode: string;
      let className: string | null = null;
      let schoolName: string | null = null;
      let schoolId: string | null = null;
      let state: string | null = null;
      let district: string | null = null;
      let city: string | null = null;
      let source: 'web' | 'app' = 'web';

      if (v.studentId && v.student) {
        key = v.studentId;
        name = v.student.allocation?.assignedName || v.student.name;
        olympiadCode = v.student.olympiadCode;
        className = v.student.allocation?.className || v.student.allocation?.classCode || null;
        schoolName = v.student.allocation?.school?.name || null;
        schoolId = v.student.allocation?.school?.schoolId || null;
        state = v.student.allocation?.school?.state || null;
        district = v.student.allocation?.school?.district || null;
        city = v.student.allocation?.school?.city || null;
        source = 'web';
      } else if (v.appUserId) {
        key = v.appUserId;
        const appUser = appUserById.get(v.appUserId);
        if (!appUser) continue;
        const alloc = appUser.olympiadId ? allocByCode.get(appUser.olympiadId) : null;
        name = alloc?.assignedName || appUser.userId;
        olympiadCode = appUser.olympiadId || '-';
        className = alloc?.className || alloc?.classCode || null;
        schoolName = alloc?.school?.name || null;
        schoolId = alloc?.school?.schoolId || null;
        state = alloc?.school?.state || null;
        district = alloc?.school?.district || null;
        city = alloc?.school?.city || null;
        source = 'app';
      } else {
        continue;
      }

      const videoEntry = {
        id: v.id,
        videoUrl: v.videoUrl,
        thumbnailUrl: v.thumbnailUrl,
        caption: v.caption,
        category: v.category,
        subCategory: v.subCategory,
        createdAt: v.createdAt,
        isEvaluated: v.evaluation !== null,
        evaluation: v.evaluation
          ? {
              totalScore: v.evaluation.totalScore,
              confidenceScore: v.evaluation.confidenceScore,
              creativityScore: v.evaluation.creativityScore,
              techniqueScore: v.evaluation.techniqueScore,
              presentationScore: v.evaluation.presentationScore,
              remarks: v.evaluation.remarks,
              evaluatorName: v.evaluation.evaluator?.name || '-',
              evaluatedAt: v.evaluation.createdAt,
            }
          : null,
      };

      if (!groupMap.has(key)) {
        groupMap.set(key, {
          studentKey: key,
          name,
          olympiadCode,
          className,
          schoolName,
          schoolId,
          state,
          district,
          city,
          source,
          videos: [videoEntry],
        });
      } else {
        groupMap.get(key)!.videos.push(videoEntry);
      }
    }

    // 4. Build final response
    const result = Array.from(groupMap.values()).map(g => {
      const totalVideos = g.videos.length;
      const evaluatedVideos = g.videos.filter(v => v.isEvaluated).length;
      const pendingVideos = totalVideos - evaluatedVideos;
      let status: 'Completed' | 'In Progress' | 'Not Started';
      if (evaluatedVideos === 0) status = 'Not Started';
      else if (evaluatedVideos >= totalVideos) status = 'Completed';
      else status = 'In Progress';

      return {
        ...g,
        totalVideos,
        evaluatedVideos,
        pendingVideos,
        status,
      };
    });

    // Sort: In Progress first, then Not Started, then Completed
    const statusOrder: Record<string, number> = { 'In Progress': 0, 'Not Started': 1, 'Completed': 2 };
    result.sort((a, b) => (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3));

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('GET reports/evaluation-progress failed:', error);
    return NextResponse.json(
      { message: 'Failed to fetch evaluation progress', error: error?.message },
      { status: 500 }
    );
  }
}
