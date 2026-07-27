import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth-guard';
import {
  KOSH_KEYS, KOSH_LABELS, KOSH_MAX_SCORE, VIDEO_MAX_SCORE, REQUIRED_VIDEOS,
  koshScoresFromVideos, koshPercent, koshGrade, combineKoshPercent,
  type KoshKey, type CriterionScores,
} from '@/lib/kosh';
import { getLatestExamResults } from '@/lib/scanner-exam';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { error } = requireRole(request, ['SUPERADMIN']);
  if (error) return error;
  try {
    const allVideos = await prisma.video.findMany({
      where: { isEvaluation: true, status: 'APPROVED', deletedAt: null },
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
        evaluations: {
          select: {
            coordinationScore: true, memoryEnergyScore: true, imaginationEmotionScore: true,
            focusLanguageScore: true, creativityJoyScore: true,
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

    type VideoEntry = {
      id: string;
      category: string | null;
      subCategory: string | null;
      slot: number;
      criteria: CriterionScores | null;
      totalScore: number | null;
      isEvaluated: boolean;
      isPublished: boolean;
      videoPercent: number | null;
      evaluatorName: string | null;
    };

    const groupMap = new Map<string, {
      studentKey: string;
      studentId: string | null;
      name: string;
      olympiadCode: string;
      className: string | null;
      schoolName: string | null;
      schoolId: string | null;
      state: string | null;
      district: string | null;
      city: string | null;
      source: 'web' | 'app';
      videos: VideoEntry[];
    }>();

    for (const v of allVideos) {
      let key: string;
      let studentId: string | null = null;
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
        studentId = v.studentId;
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

      if (!groupMap.has(key)) {
        groupMap.set(key, { studentKey: key, studentId, name, olympiadCode, className, schoolName, schoolId, state, district, city, source, videos: [] });
      }
      const group = groupMap.get(key)!;
      const slot = group.videos.length;
      const evaluation = v.evaluations[0] || null;
      const criteria: CriterionScores | null = evaluation ? {
        coordinationScore: evaluation.coordinationScore,
        memoryEnergyScore: evaluation.memoryEnergyScore,
        imaginationEmotionScore: evaluation.imaginationEmotionScore,
        focusLanguageScore: evaluation.focusLanguageScore,
        creativityJoyScore: evaluation.creativityJoyScore,
      } : null;

      group.videos.push({
        id: v.id,
        category: v.category,
        subCategory: v.subCategory,
        slot,
        criteria,
        totalScore: evaluation?.totalScore ?? null,
        isEvaluated: !!evaluation,
        isPublished: !!evaluation?.isPublished,
        videoPercent: evaluation ? Math.round((evaluation.totalScore / VIDEO_MAX_SCORE) * 1000) / 10 : null,
        evaluatorName: evaluation?.evaluator?.name || null,
      });
    }

    // The scanner (exam) app only has entries for web-registered Students —
    // app-user submissions have no exam counterpart to join against.
    const scannerStudentIds = Array.from(groupMap.values()).filter(g => g.studentId).map(g => g.studentId!);
    const examResults = await getLatestExamResults(scannerStudentIds);

    const result = Array.from(groupMap.values()).map(g => {
      const publishedVideos = g.videos.filter(v => v.isPublished && v.criteria);
      const videosReady = g.videos.length >= REQUIRED_VIDEOS && publishedVideos.length >= REQUIRED_VIDEOS;

      // Per-kosha video score = sum of the kosha's criterion across published
      // videos (max 8 with both videos), graded Beginner/Progressing/Proficient.
      // Each kosha is its own complete 100%: video 1 contributes 50% of it and
      // video 2 the other 50% (i.e. the average of both videos' 0-4 scores).
      // Only the first REQUIRED_VIDEOS published videos count, so extra
      // uploads can't push a kosha past its /8 ceiling.
      const { scores: koshScores, scoredVideos } = koshScoresFromVideos(publishedVideos.slice(0, REQUIRED_VIDEOS).map(v => v.criteria));

      const exam = g.studentId ? examResults.get(g.studentId) : undefined;

      const koshBreakdown = KOSH_KEYS.map(kosh => {
        const videoPct = koshPercent(koshScores[kosh], scoredVideos);
        const examPct = exam?.koshPercents[kosh] ?? null;
        return {
          kosh,
          label: KOSH_LABELS[kosh],
          videoScore: scoredVideos > 0 ? koshScores[kosh] : null,
          // Marks are out of 4 per scored video — 8 once both videos are in,
          // 4 while only one is, so the displayed fraction matches the %.
          videoMaxScore: scoredVideos > 0 ? Math.min(scoredVideos, REQUIRED_VIDEOS) * 4 : KOSH_MAX_SCORE,
          grade: videosReady ? koshGrade(koshScores[kosh]) : null,
          examPercent: examPct,
          videoPercent: videoPct,
          combinedPercent: combineKoshPercent(examPct, videoPct),
        };
      });

      const scoredKoshes = koshBreakdown.filter(k => k.combinedPercent !== null);
      const holisticPercent = scoredKoshes.length
        ? Math.round((scoredKoshes.reduce((sum, k) => sum + k.combinedPercent!, 0) / scoredKoshes.length) * 10) / 10
        : null;

      const videoScoreTotal = Math.round(
        publishedVideos.reduce((sum, v) => sum + (v.totalScore ?? 0), 0) * 10
      ) / 10;

      return {
        ...g,
        examPercentage: exam?.percentage ?? null,
        examTotalScore: exam?.totalScore ?? null,
        examMaxScore: exam?.maxTotalScore ?? null,
        videoScoreTotal,
        videoMaxScore: REQUIRED_VIDEOS * VIDEO_MAX_SCORE,
        koshBreakdown,
        holisticPercent,
        status: videosReady ? 'Complete' : 'Incomplete',
      };
    });

    result.sort((a, b) => {
      if (a.status !== b.status) return a.status === 'Incomplete' ? -1 : 1;
      return (b.holisticPercent ?? -1) - (a.holisticPercent ?? -1);
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('GET result/overview failed:', error);
    return NextResponse.json({ message: 'Failed to fetch results', error: error?.message }, { status: 500 });
  }
}
