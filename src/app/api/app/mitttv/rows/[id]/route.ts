import { NextResponse } from 'next/server';
import { requireMittTvViewer, rowPage } from '@/lib/mittTv';

export const dynamic = 'force-dynamic';

// GET /api/app/mitttv/rows/:id?offset=0&limit=24 — "See all": one page of a
// row's videos. nextOffset is null on the last page.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireMittTvViewer(request);
  if (viewer.error) return viewer.error;
  try {
    const { id } = await params;
    const sp = new URL(request.url).searchParams;
    const offset = Math.max(0, Math.floor(Number(sp.get('offset')) || 0));
    const limit = Math.min(60, Math.max(1, Math.floor(Number(sp.get('limit')) || 24)));
    const page = await rowPage(id, viewer.userId, offset, limit);
    if (!page) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(page);
  } catch (e) {
    console.error('mitttv row error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
