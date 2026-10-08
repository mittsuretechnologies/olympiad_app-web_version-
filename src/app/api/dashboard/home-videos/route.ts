import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth-guard';
import { getSignedMediaUrl } from '@/lib/s3';
import { generateServerThumbnail, isHomeSection } from '@/lib/homeSectionVideos';

// Server-side thumbnail fallback can download + run ffmpeg on the video.
export const maxDuration = 120;

export const dynamic = 'force-dynamic';

// GET /api/dashboard/home-videos — every Learning/Parenting video, hidden ones
// included, in display order per section. Adds short-lived signed preview URLs:
// the bucket is private, so the stored URLs don't load directly in a browser.
export async function GET(request: Request) {
  const { error } = requireRole(request, ['SUPERADMIN']);
  if (error) return error;
  try {
    const rows = await prisma.homeSectionVideo.findMany({
      orderBy: [{ section: 'asc' }, { order: 'asc' }],
    });
    const withPreviews = await Promise.all(rows.map(async (r) => ({
      ...r,
      previewVideoUrl: await getSignedMediaUrl(r.videoUrl),
      previewThumbnailUrl: await getSignedMediaUrl(r.thumbnailUrl),
    })));
    return NextResponse.json(withPreviews);
  } catch (e: any) {
    return NextResponse.json({ message: e.message }, { status: 500 });
  }
}

// POST /api/dashboard/home-videos — create a video. The files are uploaded
// first (see ./upload-url and ./upload); this only records their URLs.
export async function POST(request: Request) {
  const { error } = requireRole(request, ['SUPERADMIN']);
  if (error) return error;
  try {
    const { section, title, description, videoUrl, thumbnailUrl } = await request.json();

    if (!isHomeSection(section)) return NextResponse.json({ message: 'Choose Learning or Parenting' }, { status: 400 });
    if (!title?.trim()) return NextResponse.json({ message: 'Title is required' }, { status: 400 });
    if (!videoUrl?.trim()) return NextResponse.json({ message: 'Upload a video first' }, { status: 400 });
    // thumbnailUrl is captured automatically from the video by the dashboard.
    // When the browser couldn't (e.g. a damaged audio track makes it refuse
    // the file), the server extracts one with ffmpeg; only if that also fails
    // is the video saved without one (the app then shows a placeholder).
    const finalThumb = (typeof thumbnailUrl === 'string' && thumbnailUrl.trim())
      || await generateServerThumbnail(videoUrl.trim());

    // New videos go to the end of their section.
    const last = await prisma.homeSectionVideo.findFirst({
      where: { section },
      orderBy: { order: 'desc' },
      select: { order: true },
    });

    const created = await prisma.homeSectionVideo.create({
      data: {
        section,
        title: title.trim(),
        description: description?.trim() || '',
        videoUrl: videoUrl.trim(),
        thumbnailUrl: finalThumb,
        order: (last?.order ?? -1) + 1,
      },
    });

    return NextResponse.json({
      ...created,
      previewVideoUrl: await getSignedMediaUrl(created.videoUrl),
      previewThumbnailUrl: await getSignedMediaUrl(created.thumbnailUrl),
    }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ message: e.message }, { status: 500 });
  }
}
