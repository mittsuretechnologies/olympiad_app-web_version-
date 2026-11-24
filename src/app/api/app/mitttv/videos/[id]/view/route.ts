import { NextResponse } from 'next/server';
import { recordView, requireMittTvViewer } from '@/lib/mittTv';
import { isErpVideoId } from '@/lib/mittTvErp';

export const dynamic = 'force-dynamic';

// POST /api/app/mitttv/videos/:id/view — counts a play (once per user, video
// and day). Feeds Most Watched and the banner. Class videos from the ERP are
// not counted: they have no row in MittTvVideo (nothing of the ERP is copied).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireMittTvViewer(request);
  if (viewer.error) return viewer.error;
  try {
    const { id } = await params;
    if (isErpVideoId(id)) return NextResponse.json({ success: true, counted: false });
    if (!(await recordView(id, viewer.userId))) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('mitttv view error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
