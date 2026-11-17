import { NextResponse } from 'next/server';
import { recordView, requireMittTvViewer } from '@/lib/mittTv';

export const dynamic = 'force-dynamic';

// POST /api/app/mitttv/videos/:id/view — counts a play (once per user, video
// and day). Feeds Most Watched and the banner.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireMittTvViewer(request);
  if (viewer.error) return viewer.error;
  try {
    const { id } = await params;
    if (!(await recordView(id, viewer.userId))) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('mitttv view error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
