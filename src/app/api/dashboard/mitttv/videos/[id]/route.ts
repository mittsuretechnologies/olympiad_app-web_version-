import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth-guard';
import { clearMittTvCache, deleteMittTvMedia } from '@/lib/mittTv';
import { cleanVideoInput, setVideoRows, signedVideo } from '@/lib/mittTvAdmin';

export const dynamic = 'force-dynamic';

// PATCH /api/dashboard/mitttv/videos/:id — any subset of the fields, the
// Active switch, and `rowIds` (its banner / hand-picked rows). A replaced
// video or picture file is deleted.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin(request, 'mittTv');
  if (error) return error;
  try {
    const { id } = await params;
    const existing = await prisma.mittTvVideo.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ message: 'Video not found' }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const data = cleanVideoInput(body, true, existing.meta);
    if (typeof data === 'string') return NextResponse.json({ message: data }, { status: 400 });

    if (Object.keys(data).length) await prisma.mittTvVideo.update({ where: { id }, data });
    if (body && 'rowIds' in body) await setVideoRows(id, body.rowIds);
    clearMittTvCache();

    for (const field of ['videoUrl', 'thumbnailUrl', 'posterUrl'] as const) {
      if (field in data && data[field] !== existing[field]) await deleteMittTvMedia(existing[field]);
    }
    return NextResponse.json(await signedVideo(id));
  } catch (e: any) {
    console.error('mitttv video update error:', e);
    return NextResponse.json({ message: e.message || 'Could not save the video' }, { status: 500 });
  }
}

// DELETE /api/dashboard/mitttv/videos/:id — removes the video, its files, its
// place in every row, and everyone's progress and views of it.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin(request, 'mittTv');
  if (error) return error;
  try {
    const { id } = await params;
    const existing = await prisma.mittTvVideo.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ message: 'Video not found' }, { status: 404 });
    await prisma.mittTvVideo.delete({ where: { id } });
    clearMittTvCache();
    await Promise.all([existing.videoUrl, existing.thumbnailUrl, existing.posterUrl].map((u) => deleteMittTvMedia(u)));
    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('mitttv video delete error:', e);
    return NextResponse.json({ message: e.message || 'Could not delete the video' }, { status: 500 });
  }
}
