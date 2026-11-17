import { NextResponse } from 'next/server';
import { buildHome, requireMittTvViewer } from '@/lib/mittTv';

export const dynamic = 'force-dynamic';

// GET /api/app/mitttv/home — the whole MittTV screen for this user:
// { title, banner: { id, title, items } | null, rows: [{ id, kind, title,
// subtitle, style, items, hasMore }] }. Rows come in the SuperAdmin's order;
// rows with no videos are left out. The app skips a row kind it doesn't know.
export async function GET(request: Request) {
  const viewer = await requireMittTvViewer(request);
  if (viewer.error) return viewer.error;
  try {
    return NextResponse.json(await buildHome(viewer.userId, viewer.settings));
  } catch (e) {
    console.error('mitttv home error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
