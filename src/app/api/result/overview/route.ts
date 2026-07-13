import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth-guard';
import { koshesForSlot, videoPercentFromKoshes, koshContribution, combineKoshPercent, ALL_KOSH_LABELS, KoshKey, AnyKoshKey } from '@/lib/kosh';
import { getLatestExamResults } from '@/lib/scanner-exam';

export const dynamic = 'force-dynamic';

const VIDEO_MAX_SCORE = 20;
const REQUIRED_VIDEOS = 2;

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
            kosh: true, totalScore: true, isPublished: true, publishedAt: true, createdAt: true,
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
      videos: {
        id: string;
        category: string | null;
        subCategory: string | null;
        koshes: readonly [KoshKey, KoshKey];
        koshScores: { kosh: string | null; totalScore: number; isPublished: boolean; evaluatorName: string | null }[];
        isEvaluated: boolean;
        isPublished: boolean;
        videoPercent: number | null;
        evaluatorName: string | null;
      }[];
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
      const koshes = koshesForSlot(slot);
      const videoPercent = videoPercentFromKoshes(v.evaluations, koshes);

      group.videos.push({
        id: v.id,
        category: v.category,
        subCategory: v.subCategory,
        koshes,
        koshScores: v.evaluations.map(e => ({ kosh: e.kosh, totalScore: e.totalScore, isPublished: e.isPublished, evaluatorName: e.evaluator?.name || null })),
        isEvaluated: v.evaluations.length > 0,
        isPublished: koshes.every(k => v.evaluations.find(e => e.kosh === k)?.isPublished),
        videoPercent,
        evaluatorName: v.evaluations[0]?.evaluator?.name || null,
      });
    }

    // The scanner (exam) app only has entries for web-registered Students —
    // app-user submissions have no exam counterpart to join against.
    const scannerStudentIds = Array.from(groupMap.values()).filter(g => g.studentId).map(g => g.studentId!);
    const examResults = await getLatestExamResults(scannerStudentIds);

    const result = Array.from(groupMap.values()).map(g => {
      const publishedVideos = g.videos.filter(v => v.isPublished && v.videoPercent !== null);
      const videosReady = g.videos.length >= REQUIRED_VIDEOS && publishedVideos.length >= REQUIRED_VIDEOS;

      // Each video's own % contributes half its value to each of its 2 koshas.
      const videoKoshContributions = new Map<AnyKoshKey, number>();
      for (const v of publishedVideos) {
        const contribution = koshContribution(v.videoPercent!);
        for (const k of v.koshes) videoKoshContributions.set(k, contribution);
      }

      const exam = g.studentId ? examResults.get(g.studentId) : undefined;

      // Holistic kosh breakdown: union of every kosh either side has a
      // number for (video side: 4 koshas; exam side: whatever the scanner's
      // score_breakdown reports, which may include Manomaya).
      const koshKeys = new Set<AnyKoshKey>([...videoKoshContributions.keys(), ...(exam ? Object.keys(exam.koshPercents) as AnyKoshKey[] : [])]);
      const koshBreakdown = Array.from(koshKeys).map(kosh => {
        const videoPct = videoKoshContributions.has(kosh) ? videoKoshContributions.get(kosh)! : null;
        const examPct = exam?.koshPercents[kosh] ?? null;
        return {
          kosh,
          label: ALL_KOSH_LABELS[kosh] || kosh,
          examPercent: examPct,
          videoPercent: videoPct,
          combinedPercent: combineKoshPercent(examPct, videoPct),
        };
      }).sort((a, b) => a.kosh.localeCompare(b.kosh));

      const scoredKoshes = koshBreakdown.filter(k => k.combinedPercent !== null);
      const holisticPercent = scoredKoshes.length
        ? Math.round((scoredKoshes.reduce((sum, k) => sum + k.combinedPercent!, 0) / scoredKoshes.length) * 10) / 10
        : null;

      const videoScoreTotal = Math.round(
        publishedVideos.reduce((sum, v) => sum + (v.videoPercent! / 100) * VIDEO_MAX_SCORE, 0) * 10
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
