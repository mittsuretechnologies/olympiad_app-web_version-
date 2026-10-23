import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { requireModule } from '@/lib/auth-guard';
import { getJwtSecret } from '@/lib/jwt-secret';
import { assignedSchoolIds } from '@/lib/evaluatorRegion';

export async function GET(request: Request) {
  try {
    const auth = request.headers.get('authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    let payload: any;
    try {
      payload = jwt.verify(token, getJwtSecret());
    } catch {
      return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
    }

    if (!['EVALUATOR', 'SUPERADMIN', 'MASTER_ADMIN', 'REVIEWER'].includes(payload?.role) || !payload?.id) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    // Reviewer/SuperAdmin are oversight roles with unconditional access here;
    // Evaluator and MasterAdmin are gated by the evaluator.content module permission.
    if (payload.role === 'EVALUATOR' || payload.role === 'MASTER_ADMIN') {
      const moduleCheck = await requireModule(payload, 'evaluator.content', request);
      if (moduleCheck.error) return moduleCheck.error;
    }

    // Evaluators only see videos from the schools assigned to them
    // (Evaluator -> Assign Schools). No schools = empty queue.
    // SuperAdmin/Reviewer always see everything (oversight roles).
    let schoolFilter: Set<string> | null = null;
    if (payload.role === 'EVALUATOR') {
      schoolFilter = new Set(await assignedSchoolIds(payload.id));
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
            allocation: { select: { classCode: true, className: true, assignedName: true, school: { select: { id: true, name: true } } } },
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
          select: { code: true, classCode: true, className: true, assignedName: true, school: { select: { id: true, name: true } } },
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
      schoolId: string | null;
      ownerKey: string;
      slot: number;
      // One evaluation row per video: 5 criteria (0-4 each), one per kosha.
      existingScore: {
        coordinationScore: number;
        memoryEnergyScore: number;
        imaginationEmotionScore: number;
        focusLanguageScore: number;
        creativityJoyScore: number;
        remarks: string | null;
      } | null;
      isFullyScored: boolean;
      isFullyPublished: boolean;
    };

    const allFormatted: FormattedVideo[] = [];

    for (const [key, videos] of bySlotKey) {
      const sorted = [...videos].sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      sorted.forEach((v: any, slot: number) => {
        const evals = v.evaluations as any[];
        const anyEval = evals[0] || null;
        const existingScore = anyEval ? {
          coordinationScore: anyEval.coordinationScore,
          memoryEnergyScore: anyEval.memoryEnergyScore,
          imaginationEmotionScore: anyEval.imaginationEmotionScore,
          focusLanguageScore: anyEval.focusLanguageScore,
          creativityJoyScore: anyEval.creativityJoyScore,
          remarks: anyEval.remarks,
        } : null;
        const isFullyScored = !!anyEval;
        const isFullyPublished = !!anyEval?.isPublished;

        let studentName = '-', olympiadCode = '-', className: string | null = null, schoolName: string | null = null;
        let schoolId: string | null = null;
        if (key.startsWith('s:')) {
          studentName = v.student?.allocation?.assignedName || v.student?.name || '-';
          olympiadCode = v.student?.olympiadCode || '-';
          className = v.student?.allocation?.className || v.student?.allocation?.classCode || null;
          schoolName = v.student?.allocation?.school?.name || null;
          schoolId = v.student?.allocation?.school?.id || null;
        } else {
          const u = appUserById.get(v.appUserId!);
          const alloc = u?.olympiadId ? allocByCode.get(u.olympiadId) : null;
          studentName = alloc?.assignedName || u?.userId || '-';
          olympiadCode = u?.olympiadId || '-';
          className = alloc?.className || alloc?.classCode || null;
          schoolName = alloc?.school?.name || null;
          schoolId = alloc?.school?.id || null;
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
          schoolId,
          ownerKey: key,
          slot,
          existingScore,
          isFullyScored,
          isFullyPublished,
        });
      });
    }

    const regionScoped = schoolFilter
      ? allFormatted.filter(v => v.schoolId && schoolFilter!.has(v.schoolId))
      : allFormatted;

    // One entry per student: every student with at least one pending video
    // (or the requested target) is returned with ALL their videos, so the UI
    // can show Video 1 and Video 2 side by side inside one student card.
    const targetFormatted = targetVideoId ? regionScoped.find(v => v.id === targetVideoId) || null : null;
    const pendingOwners = new Map<string, number>(); // ownerKey -> earliest pending createdAt
    for (const v of regionScoped) {
      if (v.isFullyScored && v.id !== targetVideoId) continue;
      const t = new Date(v.createdAt).getTime();
      const prev = pendingOwners.get(v.ownerKey);
      if (prev === undefined || t < prev) pendingOwners.set(v.ownerKey, t);
    }
    if (targetFormatted) pendingOwners.set(targetFormatted.ownerKey, -Infinity);

    const finalQueue = regionScoped
      .filter(v => pendingOwners.has(v.ownerKey))
      .sort((a, b) => {
        const d = pendingOwners.get(a.ownerKey)! - pendingOwners.get(b.ownerKey)!;
        if (d !== 0 && !Number.isNaN(d)) return d;
        if (a.ownerKey !== b.ownerKey) return a.ownerKey < b.ownerKey ? -1 : 1;
        return a.slot - b.slot;
      });

    return NextResponse.json(finalQueue);
  } catch (error) {
    console.error('GET evaluator/me/evaluation-queue failed:', error);
    return NextResponse.json({ message: 'Failed to fetch queue' }, { status: 500 });
  }
}
