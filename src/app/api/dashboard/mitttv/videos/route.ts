import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth-guard';
import { clearMittTvCache, generateMittTvThumbnail } from '@/lib/mittTv';
import { cleanVideoInput, setVideoRows, signedVideo } from '@/lib/mittTvAdmin';

export const dynamic = 'force-dynamic';
// The server thumbnail fallback can download the video and run ffmpeg on it.
export const maxDuration = 120;

// POST /api/dashboard/mitttv/videos — adds a video. The files are uploaded
// first (../upload-url, ../upload, ../image); this records them. `rowIds` puts
// it in the banner / hand-picked rows chosen in the form.
export async function POST(request: Request) {
  const { error } = await requireAdmin(request, 'mittTv');
  if (error) return error;
  try {
    const body = await request.json().catch(() => ({}));
    const data = cleanVideoInput(body, false);
    if (typeof data === 'string') return NextResponse.json({ message: data }, { status: 400 });
    // The dashboard captures a thumbnail in the browser; when it couldn't, the
    // server tries with ffmpeg. Without either the app shows a placeholder.
    if (!data.thumbnailUrl) data.thumbnailUrl = await generateMittTvThumbnail(data.videoUrl);

    const created = await prisma.mittTvVideo.create({ data: { ...data, source: 'UPLOAD' } as any });
    await setVideoRows(created.id, body?.rowIds);
    clearMittTvCache();
    return NextResponse.json(await signedVideo(created.id), { status: 201 });
  } catch (e: any) {
    console.error('mitttv video create error:', e);
    return NextResponse.json({ message: e.message || 'Could not save the video' }, { status: 500 });
  }
}
