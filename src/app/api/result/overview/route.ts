import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth-guard';

export const dynamic = 'force-dynamic';

// TODO: exam score currently comes from the scanner app's own Postgres schema
// (scanner.sheet_results.total_score, joined via scanner.sheets.student_id),
// which isn't wired into this app yet. Hardcoded until that integration lands.
const EXAM_SCORE_PLACEHOLDER = 60;
const EXAM_MAX_SCORE = 60;
const VIDEO_MAX_SCORE = 20;
const REQUIRED_VIDEOS = 2;

export async function GET(request: Request) {
  const { error } = requireRole(request, ['SUPERADMIN']);
  if (error) return error;
  try {
    const allVideos = await prisma.video.findMany({
      where: { isEvaluation: true, status: 'APPROVED' },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            olympiadCode: true,
            allocation: {
              select: {
                classCode: true, className: true, assignedName: true,
                school: { select: { id: true, schoolId: true, name: true, city: true, state: true, district: true } },
              },
            },
          },
        },
        evaluation: {
          select: {
            totalScore: true, isPublished: true, publishedAt: true, createdAt: true,
            evaluator: { select: { name: true, evaluatorId: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const appUserIds = [...new Set(allVideos.filter(v => v.appUserId && !v.studentId).map(v => v.appUserId!))];
    const appUsers = appUserIds.length
      ? await prisma.appUser.findMany({ where: { id: { in: appUserIds } }, select: { id: true, userId: true, olympiadId: true } })
      : [];
    const appUserById = new Map(appUsers.map(u => [u.id, u]));

    const appOlympiadCodes = appUsers.map(u => u.olympiadId).filter(Boolean) as string[];
    const appAllocations = appOlympiadCodes.length
      ? await prisma.olympiadIdAllocation.findMany({
          where: { code: { in: appOlympiadCodes } },
          select: {
            code: true, classCode: true, className: true, assignedName: true,
            school: { select: { id: true, schoolId: true, name: true, city: true, state: true, district: true } },
          },
        })
      : [];
    const allocByCode = new Map(appAllocations.map(a => [a.code, a]));

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
        category: string | null;
        subCategory: string | null;
        isEvaluated: boolean;
        isPublished: boolean;
        totalScore: number | null;
        evaluatorName: string | null;
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
        category: v.category,
        subCategory: v.subCategory,
        isEvaluated: v.evaluation !== null,
        isPublished: v.evaluation?.isPublished || false,
        totalScore: v.evaluation?.totalScore ?? null,
        evaluatorName: v.evaluation?.evaluator?.name || null,
      };

      if (!groupMap.has(key)) {
        groupMap.set(key, { studentKey: key, name, olympiadCode, className, schoolName, schoolId, state, district, city, source, videos: [videoEntry] });
      } else {
        groupMap.get(key)!.videos.push(videoEntry);
      }
    }

    const result = Array.from(groupMap.values()).map(g => {
      const publishedVideos = g.videos.filter(v => v.isPublished);
      const videoScoreTotal = publishedVideos.reduce((sum, v) => sum + (v.totalScore || 0), 0);
      const examScore = EXAM_SCORE_PLACEHOLDER;
      const videosReady = g.videos.length >= REQUIRED_VIDEOS && publishedVideos.length >= REQUIRED_VIDEOS;
      const totalScore = examScore + videoScoreTotal;
      const maxScore = EXAM_MAX_SCORE + REQUIRED_VIDEOS * VIDEO_MAX_SCORE;

      return {
        ...g,
        examScore,
        examMaxScore: EXAM_MAX_SCORE,
        videoScoreTotal,
        videoMaxScore: REQUIRED_VIDEOS * VIDEO_MAX_SCORE,
        totalScore,
        maxScore,
        status: videosReady ? 'Complete' : 'Incomplete',
      };
    });

    result.sort((a, b) => (a.status === b.status ? b.totalScore - a.totalScore : a.status === 'Incomplete' ? -1 : 1));

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('GET result/overview failed:', error);
    return NextResponse.json({ message: 'Failed to fetch results', error: error?.message }, { status: 500 });
  }
}
