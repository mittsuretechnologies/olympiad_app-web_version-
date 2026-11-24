import { NextResponse } from 'next/server';
import { classVideoForPlayer, requireMittTvViewer, videoForPlayer } from '@/lib/mittTv';
import { isErpVideoId } from '@/lib/mittTvErp';

export const dynamic = 'force-dynamic';

// GET /api/app/mitttv/videos/:id?row=<rowId> — one video for its details page
// and the player: all its details, where this user stopped (video.progress)
// and what plays next (upNext: the row it was opened from, else videos like
// it; related.title names that list). Class videos from the ERP (erp-… ids)
// come with their class / subject / book / chapter as `info`, their other
// languages and parts as `choices`, the rest of their book as upNext, and
// where this user stopped (MittTvErpProgress).
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireMittTvViewer(request);
  if (viewer.error) return viewer.error;
  try {
    const { id } = await params;
    const rowId = new URL(request.url).searchParams.get('row');
    const data = isErpVideoId(id) ? await classVideoForPlayer(id, viewer.userId) : await videoForPlayer(id, viewer.userId, rowId);
    if (!data) return NextResponse.json({ error: 'This video is no longer available' }, { status: 404 });
    return NextResponse.json(data);
  } catch (e) {
    console.error('mitttv video error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
