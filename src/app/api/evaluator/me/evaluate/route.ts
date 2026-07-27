import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { MAX_PER_CRITERION, CRITERION_KEYS, type CriterionKey } from '@/lib/kosh';
import { recordAuditLog } from '@/lib/audit-log';
import { evaluatorCanAccessVideo } from '@/lib/evaluatorRegion';
import { requireModule } from '@/lib/auth-guard';

export async function POST(request: Request) {
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

    if (!['EVALUATOR', 'SUPERADMIN'].includes(payload?.role) || !payload?.id) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const moduleCheck = await requireModule(payload, 'evaluator.content');
    if (moduleCheck.error) return moduleCheck.error;

    let evaluatorId = payload.id;
    if (payload.role === 'SUPERADMIN') {
      const email = payload.email || 'admin@mittsure.com';
      const existingEvaluator = await prisma.talentEvaluator.findFirst({
        where: {
          OR: [
            { id: payload.id },
            { email }
          ]
        }
      });
      if (existingEvaluator) {
        evaluatorId = existingEvaluator.id;
      } else {
        const shadow = await prisma.talentEvaluator.create({
          data: {
            id: payload.id,
            evaluatorId: `ADMIN_${payload.id.slice(0, 4)}`,
            name: 'Super Admin',
            email,
            password: 'shadow_password_not_used_directly',
            isActive: true,
          }
        });
        evaluatorId = shadow.id;
      }
    }

    const body = await request.json();
    const { videoId, remarks } = body;

    // 5 criteria, one per kosha (see KOSH_CRITERIA in src/lib/kosh.ts), each 0-4.
    const scores = {} as Record<CriterionKey, number>;
    for (const key of CRITERION_KEYS) {
      const val = body[key];
      if (typeof val !== 'number' || val < 0 || val > MAX_PER_CRITERION) {
        return NextResponse.json({ message: `${key} must be between 0 and ${MAX_PER_CRITERION}` }, { status: 400 });
      }
      scores[key] = val;
    }
    if (!videoId) return NextResponse.json({ message: 'videoId is required' }, { status: 400 });

    const video = await prisma.video.findUnique({ where: { id: videoId, deletedAt: null }, include: { evaluations: true } });
    if (!video) return NextResponse.json({ message: 'Video not found' }, { status: 404 });
    if (!video.isEvaluation) return NextResponse.json({ message: 'This video is not an olympiad evaluation submission' }, { status: 400 });

    if (payload.role === 'EVALUATOR') {
      const canAccess = await evaluatorCanAccessVideo(payload.id, video);
      if (!canAccess) {
        return NextResponse.json({ message: 'This video is outside your assigned region' }, { status: 403 });
      }
    }

    // One evaluation row per video (the per-kosha breakdown lives in the
    // criterion columns, each criterion mapped 1:1 to a kosha).
    const existing = video.evaluations[0] || null;
    if (existing) {
      const isOwner = existing.evaluatorId === payload.id;
      if (payload.role !== 'SUPERADMIN' && !isOwner) {
        return NextResponse.json({ message: 'This video has already been evaluated by another evaluator' }, { status: 409 });
      }
      if (existing.isPublished) {
        return NextResponse.json({ message: 'This evaluation has been published and is locked. Unpublish it first to make changes.' }, { status: 409 });
      }
    }

    const totalScore = CRITERION_KEYS.reduce((sum, k) => sum + scores[k], 0);
    const data = {
      ...scores,
      totalScore,
      remarks: remarks?.trim() || null,
    };

    const result = existing
      ? await prisma.videoEvaluation.update({ where: { videoId }, data: { ...data, lastEditedBy: payload.id, lastEditedAt: new Date() } })
      : await prisma.videoEvaluation.create({ data: { videoId, evaluatorId, ...data } });

    await recordAuditLog({
      actorId: payload.id,
      actorRole: payload.role,
      actorName: payload.email || payload.name || null,
      action: existing ? 'EVALUATION_EDITED' : 'EVALUATION_SUBMITTED',
      entityType: 'VideoEvaluation',
      entityId: videoId,
      previousValue: existing
        ? {
            coordinationScore: existing.coordinationScore,
            memoryEnergyScore: existing.memoryEnergyScore,
            imaginationEmotionScore: existing.imaginationEmotionScore,
            focusLanguageScore: existing.focusLanguageScore,
            creativityJoyScore: existing.creativityJoyScore,
            remarks: existing.remarks,
          }
        : null,
      newValue: data,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('POST evaluator/me/evaluate failed:', error);
    return NextResponse.json({ message: 'Failed to submit evaluation' }, { status: 500 });
  }
}
