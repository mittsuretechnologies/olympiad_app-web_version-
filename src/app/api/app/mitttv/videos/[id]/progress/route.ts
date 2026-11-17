import { NextResponse } from 'next/server';
import { hideProgress, requireMittTvViewer, saveProgress } from '@/lib/mittTv';

export const dynamic = 'force-dynamic';

// POST /api/app/mitttv/videos/:id/progress { positionSec, durationSec } —
// where the user is in the video (Continue Watching). The player sends it
// every few seconds and when it closes.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireMittTvViewer(request);
  if (viewer.error) return viewer.error;
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const positionSec = Number(body?.positionSec);
    const durationSec = Number(body?.durationSec) || 0;
    if (!Number.isFinite(positionSec) || positionSec < 0) {
      return NextResponse.json({ error: 'positionSec must be a number of seconds' }, { status: 400 });
    }
    const saved = await saveProgress(id, viewer.userId, positionSec, durationSec);
    if (!saved) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ progress: saved });
  } catch (e) {
    console.error('mitttv progress error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/app/mitttv/videos/:id/progress — "Remove from Continue Watching".
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireMittTvViewer(request);
  if (viewer.error) return viewer.error;
  try {
    const { id } = await params;
    await hideProgress(id, viewer.userId);
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('mitttv progress delete error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
