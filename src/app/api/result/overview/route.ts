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
    // Which set of exam marks drives the kosha %/holistic score — AI's own
    // grading, or the human reviewer's (default, matching what the scanner
    // itself currently prefers when a question has been reviewed).
    const url = new URL(request.url);
    const examSource = url.searchParams.get('examSource') === 'ai' ? 'ai' : 'manual';

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

    // Every AppUser assigned an olympiad code — not just the ones with a
    // video — so students who only scanned an exam (or haven't done either
    // round yet) still show up in the table, not just video-submitters.
    const [allAppUsers, allAllocations, allWebStudents] = await Promise.all([
      prisma.appUser.findMany({
        where: { olympiadId: { not: null } },
        select: { id: true, userId: true, olympiadId: true, avatarUrl: true },
      }),
      prisma.olympiadIdAllocation.findMany({
        where: { assignedAt: { not: null } },
        select: {
          code: true, classCode: true, className: true, assignedName: true,
          school: { select: { id: true, schoolId: true, name: true, city: true, state: true, district: true } },
        },
      }),
      prisma.student.findMany({
        select: {
          id: true, name: true, olympiadCode: true,
          allocation: {
            select: {
              classCode: true, className: true, assignedName: true,
              school: { select: { id: true, schoolId: true, name: true, city: true, state: true, district: true } },
            },
          },
        },
      }),
    ]);
    const allocByCode = new Map(allAllocations.map(a => [a.code, a]));

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
      avatarUrl: string | null;
      videos: VideoEntry[];
    }>();

    // Seed every olympiad-registered student first — web-source (Student) and
    // app-source (AppUser, resolved through its olympiadId allocation) —
    // so students with an exam scan but no video still get a row, not just
    // video-submitters.
    for (const s of allWebStudents) {
      groupMap.set(s.id, {
        studentKey: s.id,
        studentId: s.id,
        name: s.allocation?.assignedName || s.name,
        olympiadCode: s.olympiadCode,
        className: s.allocation?.className || s.allocation?.classCode || null,
        schoolName: s.allocation?.school?.name || null,
        schoolId: s.allocation?.school?.schoolId || null,
        state: s.allocation?.school?.state || null,
        district: s.allocation?.school?.district || null,
        city: s.allocation?.school?.city || null,
        source: 'web',
        avatarUrl: null,
        videos: [],
      });
    }
    for (const u of allAppUsers) {
      const alloc = u.olympiadId ? allocByCode.get(u.olympiadId) : null;
      groupMap.set(u.id, {
        studentKey: u.id,
        studentId: null,
        name: alloc?.assignedName || u.userId,
        olympiadCode: u.olympiadId || '-',
        className: alloc?.className || alloc?.classCode || null,
        schoolName: alloc?.school?.name || null,
        schoolId: alloc?.school?.schoolId || null,
        state: alloc?.school?.state || null,
        district: alloc?.school?.district || null,
        city: alloc?.school?.city || null,
        source: 'app',
        avatarUrl: u.avatarUrl || null,
        videos: [],
      });
    }

    for (const v of allVideos) {
      const key = v.studentId && v.student ? v.studentId : v.appUserId;
      if (!key) continue;
      const group = groupMap.get(key);
      if (!group) continue; // video belongs to a student not in either seed set — skip
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

    // scanner.sheets.student_id is keyed by whichever id the student actually
    // registered/submitted under — Student.id for web-source, AppUser.id for
    // app-source (studentKey covers both, see the grouping loop above).
    const scannerStudentIds = Array.from(groupMap.keys());
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

      const exam = examResults.get(g.studentKey);

      const koshBreakdown = KOSH_KEYS.map(kosh => {
        const videoPct = koshPercent(koshScores[kosh], scoredVideos);
        const examPct = (examSource === 'ai' ? exam?.aiKoshPercents[kosh] : exam?.manualKoshPercents[kosh]) ?? null;
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

      const examPercentage = exam
        ? (examSource === 'ai'
            ? (exam.aiMaxScore ? Math.round((exam.aiTotalScore / exam.aiMaxScore) * 1000) / 10 : null)
            : (exam.manualTotalScore !== null && exam.manualMaxScore ? Math.round((exam.manualTotalScore / exam.manualMaxScore) * 1000) / 10 : null))
        : null;

      return {
        ...g,
        examSource,
        examPercentage,
        examTotalScore: exam?.totalScore ?? null,
        examMaxScore: exam?.maxTotalScore ?? null,
        examAiTotalScore: exam?.aiTotalScore ?? null,
        examAiMaxScore: exam?.aiMaxScore ?? null,
        examManualTotalScore: exam?.manualTotalScore ?? null,
        examManualMaxScore: exam?.manualMaxScore ?? null,
        examManualQuestionCount: exam?.manualQuestionCount ?? 0,
        examQuestions: exam?.questions ?? [],
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
