import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { koshesForSlot, videoPercentFromKoshes } from '@/lib/kosh';

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

    // To know each video's slot (1st/2nd upload → which koshas apply) we
    // need every student's/app-user's evaluation-video createdAt timestamps.
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

    const groupMap = new Map<string, {
      studentKey: string;
      studentName: string;
      username: string | null;
      olympiadCode: string;
      className: string | null;
      schoolName: string | null;
      videosByVideoId: Map<string, {
        videoId: string;
        videoUrl: string;
        thumbnailUrl: string | null;
        category: string;
        subCategory: string;
        slot: number;
        koshes: readonly [string, string];
        koshScores: Record<string, {
          id: string;
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
        }>;
      }>;
    }>();

    for (const e of evaluations) {
      // Legacy rows scored before the kosh system existed have no kosh —
      // they can't be attributed to a slot, so they're omitted from history.
      if (!e.kosh) continue;
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

      if (!group.videosByVideoId.has(e.videoId)) {
        const slot = slotForVideo(e.videoId);
        group.videosByVideoId.set(e.videoId, {
          videoId: e.videoId,
          videoUrl: v.videoUrl,
          thumbnailUrl: v.thumbnailUrl,
          category: v.category || '',
          subCategory: v.subCategory || '',
          slot,
          koshes: koshesForSlot(slot),
          koshScores: {},
        });
      }

      group.videosByVideoId.get(e.videoId)!.koshScores[e.kosh] = {
        id: e.id,
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
    }

    const result = Array.from(groupMap.values()).map(g => {
      const videos = Array.from(g.videosByVideoId.values())
        .sort((a, b) => a.slot - b.slot)
        .map(v => {
          const koshList = Object.entries(v.koshScores).map(([kosh, s]) => ({ kosh, ...s }));
          const videoPercent = videoPercentFromKoshes(
            koshList.map(k => ({ kosh: k.kosh, totalScore: k.totalScore })),
            v.koshes
          );
          const isFullyScored = v.koshes.every(k => v.koshScores[k]);
          const isFullyPublished = isFullyScored && v.koshes.every(k => v.koshScores[k].isPublished);
          return { ...v, koshList, videoPercent, isFullyScored, isFullyPublished };
        });

      const scoredVideoPercents = videos.map(v => v.videoPercent).filter((p): p is number => p !== null);
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
        combinedPercent,
        allPublished: videos.length > 0 && videos.every(v => v.isFullyPublished),
      };
    });

    result.sort((a, b) => {
      const aLatest = Math.max(...a.videos.flatMap(v => Object.values(v.koshScores).map(s => s.createdAt.getTime())), 0);
      const bLatest = Math.max(...b.videos.flatMap(v => Object.values(v.koshScores).map(s => s.createdAt.getTime())), 0);
      return bLatest - aLatest;
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('GET evaluator/me/evaluation-history failed:', error);
    return NextResponse.json({ message: 'Failed to fetch history' }, { status: 500 });
  }
}
