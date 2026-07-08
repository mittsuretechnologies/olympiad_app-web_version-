import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';

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

    const video = await prisma.video.findUnique({ where: { id: videoId, deletedAt: null }, include: { evaluation: true } });
    if (!video) return NextResponse.json({ message: 'Video not found' }, { status: 404 });
    if (!video.isEvaluation) return NextResponse.json({ message: 'This video is not an olympiad evaluation submission' }, { status: 400 });

    const isOwner = video.evaluation?.evaluatorId === payload.id;
    if (video.evaluation && payload.role !== 'SUPERADMIN' && !isOwner) {
      return NextResponse.json({ message: 'This video has already been evaluated' }, { status: 409 });
    }
    if (video.evaluation?.isPublished) {
      return NextResponse.json({ message: 'This evaluation has been published and is locked. Unpublish it first to make changes.' }, { status: 409 });
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

    const evaluation = video.evaluation
      ? await prisma.videoEvaluation.update({ where: { videoId }, data: { ...data, lastEditedBy: payload.id, lastEditedAt: new Date() } })
      : await prisma.videoEvaluation.create({ data: { videoId, evaluatorId, ...data } });

    return NextResponse.json(evaluation);
  } catch (error) {
    console.error('POST evaluator/me/evaluate failed:', error);
    return NextResponse.json({ message: 'Failed to submit evaluation' }, { status: 500 });
  }
}
