import { NextResponse } from 'next/server';
import { requireMittTvViewer, videoForPlayer } from '@/lib/mittTv';

export const dynamic = 'force-dynamic';

// GET /api/app/mitttv/videos/:id?row=<rowId> — one video for its details page
// and the player: all its details, where this user stopped (video.progress)
// and what plays next (upNext: the row it was opened from, else videos like
// it; related.title names that list).
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireMittTvViewer(request);
  if (viewer.error) return viewer.error;
  try {
    const { id } = await params;
    const rowId = new URL(request.url).searchParams.get('row');
    const data = await videoForPlayer(id, viewer.userId, rowId);
    if (!data) return NextResponse.json({ error: 'This video is no longer available' }, { status: 404 });
    return NextResponse.json(data);
  } catch (e) {
    console.error('mitttv video error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
