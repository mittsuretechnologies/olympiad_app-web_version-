import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { koshesForSlot } from '@/lib/kosh';
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
    // only Evaluator is gated by the evaluator.content module permission.
    if (payload.role === 'EVALUATOR') {
      const moduleCheck = await requireModule(payload, 'evaluator.content');
      if (moduleCheck.error) return moduleCheck.error;
    }

    // Evaluators can be scoped to specific states by code (see TalentEvaluator
    // .assignedStates, e.g. ["RJ", "GJ"]). Empty array = unrestricted.
    // SuperAdmin/Reviewer always see everything (oversight roles).
    let regionFilter: string[] | null = null;
    if (payload.role === 'EVALUATOR') {
      const evaluator = await prisma.talentEvaluator.findUnique({
        where: { id: payload.id },
        select: { assignedStates: true },
      });
      if (evaluator && evaluator.assignedStates.length > 0) {
        regionFilter = evaluator.assignedStates;
      }
    }

    const { searchParams } = new URL(request.url);
    const targetVideoId = searchParams.get('videoId');

    // Pull every approved evaluation video (student + app-user), grouped by
    // owner, so we can determine each video's slot (1st/2nd upload) and
    // therefore which pair of koshas it must be scored against.
    const studentVideos = await prisma.video.findMany({
      where: { isEvaluation: true, status: 'APPROVED', studentId: { not: null }, deletedAt: null },
      include: {
        student: {
          select: {
            id: true, name: true, olympiadCode: true,
            allocation: { select: { classCode: true, className: true, assignedName: true, school: { select: { name: true, stateCode: true } } } },
          },
        },
        evaluations: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const appVideos = await prisma.video.findMany({
      where: { isEvaluation: true, status: 'APPROVED', appUserId: { not: null }, deletedAt: null },
      include: { evaluations: true },
      orderBy: { createdAt: 'asc' },
    });

    const appUserIds = [...new Set(appVideos.map(v => v.appUserId!).filter(Boolean))];
    const appUsers = appUserIds.length
      ? await prisma.appUser.findMany({ where: { id: { in: appUserIds } }, select: { id: true, userId: true, olympiadId: true } })
      : [];
    const appUserById = new Map(appUsers.map(u => [u.id, u]));

    const olympiadCodes = appUsers.map(u => u.olympiadId).filter(Boolean) as string[];
    const allocations = olympiadCodes.length
      ? await prisma.olympiadIdAllocation.findMany({
          where: { code: { in: olympiadCodes } },
          select: { code: true, classCode: true, className: true, assignedName: true, school: { select: { name: true, stateCode: true } } },
        })
      : [];
    const allocByCode = new Map(allocations.map(a => [a.code, a]));

    // Group each owner's videos so we can assign slot 0 / slot 1 by createdAt order.
    const bySlotKey = new Map<string, typeof studentVideos | typeof appVideos>();
    for (const v of studentVideos) {
      const key = `s:${v.studentId}`;
      if (!bySlotKey.has(key)) bySlotKey.set(key, []);
      (bySlotKey.get(key) as any[]).push(v);
    }
    for (const v of appVideos) {
      const key = `a:${v.appUserId}`;
      if (!bySlotKey.has(key)) bySlotKey.set(key, []);
      (bySlotKey.get(key) as any[]).push(v);
    }

    type FormattedVideo = {
      id: string;
      videoUrl: string;
      thumbnailUrl: string | null;
      caption: string;
      category: string;
      subCategory: string;
      createdAt: Date;
      studentName: string;
      olympiadCode: string;
      className: string | null;
      schoolName: string | null;
      schoolStateCode: string | null;
      slot: number;
      koshes: readonly [string, string];
      // A video has one scoring form; its result is stored under both
      // koshas with identical values, so any one row represents the video.
      existingScore: {
        confidenceScore: number;
        creativityScore: number;
        techniqueScore: number;
        presentationScore: number;
        remarks: string | null;
      } | null;
      isFullyScored: boolean;
      isFullyPublished: boolean;
    };

    const allFormatted: FormattedVideo[] = [];

    for (const [key, videos] of bySlotKey) {
      const sorted = [...videos].sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      sorted.forEach((v: any, slot: number) => {
        const koshes = koshesForSlot(slot);
        const evals = v.evaluations as any[];
        const anyEval = evals[0] || null;
        const existingScore = anyEval ? {
          confidenceScore: anyEval.confidenceScore,
          creativityScore: anyEval.creativityScore,
          techniqueScore: anyEval.techniqueScore,
          presentationScore: anyEval.presentationScore,
          remarks: anyEval.remarks,
        } : null;
        const isFullyScored = koshes.every(k => evals.some(e => e.kosh === k));
        const isFullyPublished = koshes.every(k => evals.find(e => e.kosh === k)?.isPublished);

        let studentName = '-', olympiadCode = '-', className: string | null = null, schoolName: string | null = null;
        let schoolStateCode: string | null = null;
        if (key.startsWith('s:')) {
          studentName = v.student?.allocation?.assignedName || v.student?.name || '-';
          olympiadCode = v.student?.olympiadCode || '-';
          className = v.student?.allocation?.className || v.student?.allocation?.classCode || null;
          schoolName = v.student?.allocation?.school?.name || null;
          schoolStateCode = v.student?.allocation?.school?.stateCode || null;
        } else {
          const u = appUserById.get(v.appUserId!);
          const alloc = u?.olympiadId ? allocByCode.get(u.olympiadId) : null;
          studentName = alloc?.assignedName || u?.userId || '-';
          olympiadCode = u?.olympiadId || '-';
          className = alloc?.className || alloc?.classCode || null;
          schoolName = alloc?.school?.name || null;
          schoolStateCode = alloc?.school?.stateCode || null;
        }

        allFormatted.push({
          id: v.id,
          videoUrl: v.videoUrl,
          thumbnailUrl: v.thumbnailUrl || null,
          caption: v.caption || '',
          category: v.category || '',
          subCategory: v.subCategory || '',
          createdAt: v.createdAt,
          studentName,
          olympiadCode,
          className,
          schoolName,
          schoolStateCode,
          slot,
          koshes,
          existingScore,
          isFullyScored,
          isFullyPublished,
        });
      });
    }

    const regionScoped = regionFilter
      ? allFormatted.filter(v => v.schoolStateCode && regionFilter!.includes(v.schoolStateCode))
      : allFormatted;

    const targetFormatted = targetVideoId ? regionScoped.find(v => v.id === targetVideoId) || null : null;
    const restQueue = regionScoped
      .filter(v => v.id !== targetVideoId && !v.isFullyScored)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    const finalQueue = targetFormatted ? [targetFormatted, ...restQueue] : restQueue;

    return NextResponse.json(finalQueue);
  } catch (error) {
    console.error('GET evaluator/me/evaluation-queue failed:', error);
    return NextResponse.json({ message: 'Failed to fetch queue' }, { status: 500 });
  }
}
