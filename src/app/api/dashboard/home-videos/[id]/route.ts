import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth-guard';
import { getSignedMediaUrl } from '@/lib/s3';
import { deleteHomeVideoMedia, generateServerThumbnail, isHomeSection } from '@/lib/homeSectionVideos';

export const dynamic = 'force-dynamic';
// Server-side thumbnail fallback can download + run ffmpeg on the video.
export const maxDuration = 120;

// PATCH /api/dashboard/home-videos/:id — edit any subset of fields, or toggle
// isActive / inCarousel. Replacing the video or thumbnail deletes the old file.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = requireRole(request, ['SUPERADMIN']);
  if (error) return error;
  try {
    const { id } = await params;
    const existing = await prisma.homeSectionVideo.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ message: 'Video not found' }, { status: 404 });

    const body = await request.json();
    const data: Record<string, any> = {};
    if ('section' in body) {
      if (!isHomeSection(body.section)) return NextResponse.json({ message: 'Choose Learning or Parenting' }, { status: 400 });
      data.section = body.section;
    }
    if ('title' in body) {
      const title = String(body.title ?? '').trim();
      if (!title) return NextResponse.json({ message: 'Title is required' }, { status: 400 });
      data.title = title;
    }
    if ('description' in body) data.description = String(body.description ?? '').trim();
    if ('videoUrl' in body && String(body.videoUrl).trim()) data.videoUrl = String(body.videoUrl).trim();
    // A replaced video brings its own auto-captured thumbnail — or none, if no
    // frame could be captured, which must clear the old video's thumbnail.
    if ('thumbnailUrl' in body && data.videoUrl) data.thumbnailUrl = String(body.thumbnailUrl ?? '').trim();
    if ('isActive' in body) data.isActive = Boolean(body.isActive);
    if ('inCarousel' in body) data.inCarousel = Boolean(body.inCarousel);

    // No thumbnail after this edit (a replaced video the browser couldn't
    // capture, or an older row saved without one): make one on the server.
    // Saving an edit is therefore also how a missing thumbnail gets repaired.
    const finalVideoUrl = data.videoUrl ?? existing.videoUrl;
    const finalThumb = 'thumbnailUrl' in data ? data.thumbnailUrl : existing.thumbnailUrl;
    if (!finalThumb) {
      const generated = await generateServerThumbnail(finalVideoUrl);
      if (generated) data.thumbnailUrl = generated;
    }

    // Moving to the other section puts it at the end of that section.
    if (data.section && data.section !== existing.section) {
      const last = await prisma.homeSectionVideo.findFirst({
        where: { section: data.section },
        orderBy: { order: 'desc' },
        select: { order: true },
      });
      data.order = (last?.order ?? -1) + 1;
    }

    const updated = await prisma.homeSectionVideo.update({ where: { id }, data });

    if (data.videoUrl && data.videoUrl !== existing.videoUrl) await deleteHomeVideoMedia(existing.videoUrl);
    if ('thumbnailUrl' in data && data.thumbnailUrl !== existing.thumbnailUrl) await deleteHomeVideoMedia(existing.thumbnailUrl);

    return NextResponse.json({
      ...updated,
      previewVideoUrl: await getSignedMediaUrl(updated.videoUrl),
      previewThumbnailUrl: await getSignedMediaUrl(updated.thumbnailUrl),
    });
  } catch (e: any) {
    return NextResponse.json({ message: e.message }, { status: 500 });
  }
}

// DELETE /api/dashboard/home-videos/:id — removes the row and its files.
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = requireRole(request, ['SUPERADMIN']);
  if (error) return error;
  try {
    const { id } = await params;
    const existing = await prisma.homeSectionVideo.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ message: 'Video not found' }, { status: 404 });

    await prisma.homeSectionVideo.delete({ where: { id } });
    await deleteHomeVideoMedia(existing.videoUrl);
    await deleteHomeVideoMedia(existing.thumbnailUrl);

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ message: e.message }, { status: 500 });
  }
}
