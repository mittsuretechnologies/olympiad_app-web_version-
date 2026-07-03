import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';

const MAX_PER_CRITERION = 20;

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

    if (payload?.role !== 'EVALUATOR' || !payload?.id) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const { videoId, confidenceScore, creativityScore, techniqueScore, presentationScore, overallScore, remarks } = await request.json();

    const scores = { confidenceScore, creativityScore, techniqueScore, presentationScore, overallScore };
    for (const [key, val] of Object.entries(scores)) {
      if (typeof val !== 'number' || val < 0 || val > MAX_PER_CRITERION) {
        return NextResponse.json({ message: `${key} must be between 0 and ${MAX_PER_CRITERION}` }, { status: 400 });
      }
    }
    if (!videoId) return NextResponse.json({ message: 'videoId is required' }, { status: 400 });

    const video = await prisma.video.findUnique({ where: { id: videoId, deletedAt: null }, include: { evaluation: true } });
    if (!video) return NextResponse.json({ message: 'Video not found' }, { status: 404 });
    if (!video.isEvaluation) return NextResponse.json({ message: 'This video is not an olympiad evaluation submission' }, { status: 400 });
    if (video.evaluation) return NextResponse.json({ message: 'This video has already been evaluated' }, { status: 409 });

    const totalScore = confidenceScore + creativityScore + techniqueScore + presentationScore + overallScore;

    const evaluation = await prisma.videoEvaluation.create({
      data: {
        videoId,
        evaluatorId: payload.id,
        confidenceScore,
        creativityScore,
        techniqueScore,
        presentationScore,
        overallScore,
        totalScore,
        remarks: remarks?.trim() || null,
      },
    });

    return NextResponse.json(evaluation);
  } catch (error) {
    console.error('POST evaluator/me/evaluate failed:', error);
    return NextResponse.json({ message: 'Failed to submit evaluation' }, { status: 500 });
  }
}
