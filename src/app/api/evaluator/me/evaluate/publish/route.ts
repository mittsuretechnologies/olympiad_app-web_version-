import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth-guard';

export async function POST(request: Request) {
  const { error, payload } = requireRole(request, ['SUPERADMIN', 'EVALUATOR']);
  if (error) return error;

  try {
    const { videoId, publish } = await request.json();
    if (!videoId) return NextResponse.json({ message: 'videoId is required' }, { status: 400 });

    // A video has one scoring form whose result is stored under both of its
    // koshas, so publish/unpublish always applies to both rows together.
    const where = { videoId };
    const existingList = await prisma.videoEvaluation.findMany({ where });
    if (existingList.length === 0) return NextResponse.json({ message: 'No evaluation found for this video' }, { status: 404 });

    if (payload!.role === 'EVALUATOR') {
      if (existingList.some(e => e.evaluatorId !== payload!.id)) {
        return NextResponse.json({ message: 'You can only publish your own evaluations' }, { status: 403 });
      }
      if (!publish) {
        return NextResponse.json({ message: 'Only an admin can unpublish a result' }, { status: 403 });
      }
    }

    const data = publish
      ? { isPublished: true, publishedAt: new Date(), lastEditedBy: payload!.id, lastEditedAt: new Date() }
      : { isPublished: false, publishedAt: null, lastEditedBy: payload!.id, lastEditedAt: new Date() };

    await prisma.videoEvaluation.updateMany({ where, data });
    const evaluations = await prisma.videoEvaluation.findMany({ where });

    return NextResponse.json(evaluations);
  } catch (e: any) {
    return NextResponse.json({ message: e.message }, { status: 500 });
  }
}
