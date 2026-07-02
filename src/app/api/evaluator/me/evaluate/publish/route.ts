import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth-guard';

export async function POST(request: Request) {
  const { error, payload } = requireRole(request, ['SUPERADMIN', 'EVALUATOR']);
  if (error) return error;

  try {
    const { videoId, publish } = await request.json();
    if (!videoId) return NextResponse.json({ message: 'videoId is required' }, { status: 400 });

    const existing = await prisma.videoEvaluation.findUnique({ where: { videoId } });
    if (!existing) return NextResponse.json({ message: 'No evaluation found for this video' }, { status: 404 });

    if (payload!.role === 'EVALUATOR') {
      if (existing.evaluatorId !== payload!.id) {
        return NextResponse.json({ message: 'You can only publish your own evaluations' }, { status: 403 });
      }
      if (!publish) {
        return NextResponse.json({ message: 'Only an admin can unpublish a result' }, { status: 403 });
      }
    }

    const evaluation = await prisma.videoEvaluation.update({
      where: { videoId },
      data: publish
        ? { isPublished: true, publishedAt: new Date(), lastEditedBy: payload!.id, lastEditedAt: new Date() }
        : { isPublished: false, publishedAt: null, lastEditedBy: payload!.id, lastEditedAt: new Date() },
    });

    return NextResponse.json(evaluation);
  } catch (e: any) {
    return NextResponse.json({ message: e.message }, { status: 500 });
  }
}
