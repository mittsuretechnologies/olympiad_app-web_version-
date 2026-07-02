import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';

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

    const isEvaluator = payload.role === 'EVALUATOR';
    const filter = isEvaluator ? { evaluatorId: payload.id } : {};

    const evaluations = await prisma.videoEvaluation.findMany({
      where: filter,
      include: {
        video: {
          include: {
            student: { select: { name: true, olympiadCode: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const appUserIds = evaluations.map(e => e.video.appUserId).filter(Boolean) as string[];
    const appUsers = await prisma.appUser.findMany({
      where: { id: { in: appUserIds } },
      select: { id: true, userId: true, olympiadId: true },
    });
    const appUserById = new Map(appUsers.map(u => [u.id, u]));

    const result = evaluations.map(e => ({
      id: e.id,
      videoId: e.videoId,
      videoUrl: e.video.videoUrl,
      thumbnailUrl: e.video.thumbnailUrl,
      category: e.video.category,
      subCategory: e.video.subCategory,
      studentName: e.video.student?.name || appUserById.get(e.video.appUserId || '')?.userId || '-',
      olympiadCode: e.video.student?.olympiadCode || appUserById.get(e.video.appUserId || '')?.olympiadId || '-',
      confidenceScore: e.confidenceScore,
      creativityScore: e.creativityScore,
      techniqueScore: e.techniqueScore,
      presentationScore: e.presentationScore,
      totalScore: e.totalScore,
      remarks: e.remarks,
      createdAt: e.createdAt,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('GET evaluator/me/evaluation-history failed:', error);
    return NextResponse.json({ message: 'Failed to fetch history' }, { status: 500 });
  }
}
