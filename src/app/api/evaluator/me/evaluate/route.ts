import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { koshesForSlot, videoSlot } from '@/lib/kosh';
import { recordAuditLog } from '@/lib/audit-log';

const MAX_PER_CRITERION = 5;

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

    const { videoId, confidenceScore, creativityScore, techniqueScore, presentationScore, remarks } = await request.json();

    const scores = { confidenceScore, creativityScore, techniqueScore, presentationScore };
    for (const [key, val] of Object.entries(scores)) {
      if (typeof val !== 'number' || val < 0 || val > MAX_PER_CRITERION) {
        return NextResponse.json({ message: `${key} must be between 0 and ${MAX_PER_CRITERION}` }, { status: 400 });
      }
    }
    if (!videoId) return NextResponse.json({ message: 'videoId is required' }, { status: 400 });

    const video = await prisma.video.findUnique({ where: { id: videoId, deletedAt: null }, include: { evaluations: true } });
    if (!video) return NextResponse.json({ message: 'Video not found' }, { status: 404 });
    if (!video.isEvaluation) return NextResponse.json({ message: 'This video is not an olympiad evaluation submission' }, { status: 400 });

    // One scoring form per video, but the same score is recorded twice —
    // once per kosh assigned to this video's slot (1st video: Annamaya +
    // Pranamaya, 2nd video: Vijnanamaya + Anandamaya) — so each kosh gets
    // this video's % as its contribution.
    const siblingVideos = await prisma.video.findMany({
      where: {
        isEvaluation: true,
        deletedAt: null,
        ...(video.studentId ? { studentId: video.studentId } : { appUserId: video.appUserId }),
      },
      select: { id: true, createdAt: true },
    });
    const slot = videoSlot(video.createdAt, siblingVideos.map(v => v.createdAt));
    const koshes = koshesForSlot(Math.max(slot, 0));

    const existingByKosh = new Map(video.evaluations.map(e => [e.kosh, e]));
    for (const kosh of koshes) {
      const existing = existingByKosh.get(kosh);
      const isOwner = existing?.evaluatorId === payload.id;
      if (existing && payload.role !== 'SUPERADMIN' && !isOwner) {
        return NextResponse.json({ message: 'This video has already been evaluated by another evaluator' }, { status: 409 });
      }
      if (existing?.isPublished) {
        return NextResponse.json({ message: 'This evaluation has been published and is locked. Unpublish it first to make changes.' }, { status: 409 });
      }
    }

    const totalScore = confidenceScore + creativityScore + techniqueScore + presentationScore;
    const data = {
      confidenceScore,
      creativityScore,
      techniqueScore,
      presentationScore,
      totalScore,
      remarks: remarks?.trim() || null,
    };

    const results = await Promise.all(koshes.map(kosh => {
      const existing = existingByKosh.get(kosh);
      return existing
        ? prisma.videoEvaluation.update({ where: { videoId_kosh: { videoId, kosh } }, data: { ...data, lastEditedBy: payload.id, lastEditedAt: new Date() } })
        : prisma.videoEvaluation.create({ data: { videoId, kosh, evaluatorId, ...data } });
    }));

    await Promise.all(koshes.map(kosh => {
      const existing = existingByKosh.get(kosh);
      return recordAuditLog({
        actorId: payload.id,
        actorRole: payload.role,
        actorName: payload.email || payload.name || null,
        action: existing ? 'EVALUATION_EDITED' : 'EVALUATION_SUBMITTED',
        entityType: 'VideoEvaluation',
        entityId: videoId,
        previousValue: existing
          ? { confidenceScore: existing.confidenceScore, creativityScore: existing.creativityScore, techniqueScore: existing.techniqueScore, presentationScore: existing.presentationScore, remarks: existing.remarks, kosh }
          : null,
        newValue: { ...data, kosh },
      });
    }));

    return NextResponse.json(results[0]);
  } catch (error) {
    console.error('POST evaluator/me/evaluate failed:', error);
    return NextResponse.json({ message: 'Failed to submit evaluation' }, { status: 500 });
  }
}
