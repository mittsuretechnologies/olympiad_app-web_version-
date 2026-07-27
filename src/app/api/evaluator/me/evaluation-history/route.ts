import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { videoPercent, koshScoresFromVideos, koshGrade, koshPercent, KOSH_KEYS, KOSH_MAX_SCORE, REQUIRED_VIDEOS, type CriterionScores } from '@/lib/kosh';
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

    // Reviewer/SuperAdmin are oversight roles with unconditional access here;
    // only Evaluator is gated by the evaluator.history module permission.
    if (payload.role === 'EVALUATOR') {
      const moduleCheck = await requireModule(payload, 'evaluator.history');
      if (moduleCheck.error) return moduleCheck.error;
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

    // To know each video's slot (1st/2nd upload → Focus vs Language label for
    // the Vijnanamaya criterion) we need every owner's evaluation-video
    // createdAt timestamps.
    const ownerKeyFor = (v: { studentId: string | null; appUserId: string | null }) =>
      v.studentId ? `s:${v.studentId}` : `a:${v.appUserId}`;

    const videoIds = [...new Set(evaluations.map(e => e.videoId))];
    const allOwnerVideos = await prisma.video.findMany({
      where: { id: { in: videoIds } },
      select: { id: true, studentId: true, appUserId: true, createdAt: true },
    });
    const ownerKeyByVideoId = new Map(allOwnerVideos.map(v => [v.id, ownerKeyFor(v)]));
    const siblingsByOwnerKey = await prisma.video.findMany({
      where: {
        isEvaluation: true,
        OR: [
          { studentId: { in: allOwnerVideos.filter(v => v.studentId).map(v => v.studentId!) } },
          { appUserId: { in: allOwnerVideos.filter(v => v.appUserId).map(v => v.appUserId!) } },
        ],
      },
      select: { id: true, studentId: true, appUserId: true, createdAt: true },
    }).then(rows => {
      const map = new Map<string, { id: string; createdAt: Date }[]>();
      for (const r of rows) {
        const key = ownerKeyFor(r);
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push({ id: r.id, createdAt: r.createdAt });
      }
      return map;
    });

    function slotForVideo(videoId: string): number {
      const key = ownerKeyByVideoId.get(videoId);
      if (!key) return 0;
      const siblings = siblingsByOwnerKey.get(key) || [];
      const sorted = [...siblings].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      return Math.max(sorted.findIndex(s => s.id === videoId), 0);
    }

    type VideoEntry = {
      videoId: string;
      videoUrl: string;
      thumbnailUrl: string | null;
      category: string;
      subCategory: string;
      slot: number;
      evaluation: {
        id: string;
        coordinationScore: number;
        memoryEnergyScore: number;
        imaginationEmotionScore: number;
        focusLanguageScore: number;
        creativityJoyScore: number;
        totalScore: number;
        remarks: string | null;
        createdAt: Date;
        isPublished: boolean;
        publishedAt: Date | null;
        evaluatorName: string;
        evaluatorId: string;
      };
    };

    const groupMap = new Map<string, {
      studentKey: string;
      studentName: string;
      username: string | null;
      olympiadCode: string;
      className: string | null;
      schoolName: string | null;
      videosByVideoId: Map<string, VideoEntry>;
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

      if (!groupMap.has(key)) {
        groupMap.set(key, { studentKey: key, studentName, username, olympiadCode, className, schoolName, videosByVideoId: new Map() });
      }
      const group = groupMap.get(key)!;

      group.videosByVideoId.set(e.videoId, {
        videoId: e.videoId,
        videoUrl: v.videoUrl,
        thumbnailUrl: v.thumbnailUrl,
        category: v.category || '',
        subCategory: v.subCategory || '',
        slot: slotForVideo(e.videoId),
        evaluation: {
          id: e.id,
          coordinationScore: e.coordinationScore,
          memoryEnergyScore: e.memoryEnergyScore,
          imaginationEmotionScore: e.imaginationEmotionScore,
          focusLanguageScore: e.focusLanguageScore,
          creativityJoyScore: e.creativityJoyScore,
          totalScore: e.totalScore,
          remarks: e.remarks,
          createdAt: e.createdAt,
          isPublished: e.isPublished,
          publishedAt: e.publishedAt,
          evaluatorName: e.evaluator?.name || '-',
          evaluatorId: e.evaluatorId,
        },
      });
    }

    const result = Array.from(groupMap.values()).map(g => {
      const videos = Array.from(g.videosByVideoId.values())
        .sort((a, b) => a.slot - b.slot)
        .map(v => ({
          ...v,
          videoPercent: videoPercent(v.evaluation.totalScore),
          isPublished: v.evaluation.isPublished,
        }));

      // Per-kosha grading: sum each kosha's criterion across the student's
      // scored videos (max 8 with both), banded Beginner/Progressing/Proficient.
      // Only the first REQUIRED_VIDEOS evaluated videos count, so extra
      // uploads can't push a kosha past its /8 ceiling.
      const { scores: koshScores, scoredVideos } = koshScoresFromVideos(
        videos.slice(0, REQUIRED_VIDEOS).map(v => v.evaluation as CriterionScores)
      );
      const koshBreakdown = KOSH_KEYS.map(kosh => ({
        kosh,
        score: koshScores[kosh],
        maxScore: scoredVideos > 0 ? Math.min(scoredVideos, REQUIRED_VIDEOS) * 4 : KOSH_MAX_SCORE,
        percent: koshPercent(koshScores[kosh], scoredVideos),
        grade: scoredVideos > 0 ? koshGrade(koshScores[kosh]) : null,
      }));

      const scoredVideoPercents = videos.map(v => v.videoPercent);
      const combinedPercent = scoredVideoPercents.length
        ? Math.round((scoredVideoPercents.reduce((a, b) => a + b, 0) / scoredVideoPercents.length) * 10) / 10
        : null;

      return {
        studentKey: g.studentKey,
        studentName: g.studentName,
        username: g.username,
        olympiadCode: g.olympiadCode,
        className: g.className,
        schoolName: g.schoolName,
        videos,
        videoCount: videos.length,
        koshBreakdown,
        combinedPercent,
        allPublished: videos.length > 0 && videos.every(v => v.isPublished),
      };
    });

    result.sort((a, b) => {
      const aLatest = Math.max(...a.videos.map(v => v.evaluation.createdAt.getTime()), 0);
      const bLatest = Math.max(...b.videos.map(v => v.evaluation.createdAt.getTime()), 0);
      return bLatest - aLatest;
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('GET evaluator/me/evaluation-history failed:', error);
    return NextResponse.json({ message: 'Failed to fetch history' }, { status: 500 });
  }
}
