import { NextResponse } from 'next/server';
import { requireMittTvViewer, searchSuggestions, searchVideos } from '@/lib/mittTv';

export const dynamic = 'force-dynamic';

// GET /api/app/mitttv/search?q=<text>&offset=0&limit=20 — MittTV search
// (title, description and tags). With no q: { popular } for the empty search
// screen. Off when the SuperAdmin switched search off in MittTV → Settings.
export async function GET(request: Request) {
  const viewer = await requireMittTvViewer(request);
  if (viewer.error) return viewer.error;
  if (!viewer.settings.searchEnabled) {
    return NextResponse.json({ error: 'Search is not available right now', code: 'SEARCH_OFF' }, { status: 403 });
  }
  try {
    const sp = new URL(request.url).searchParams;
    const q = (sp.get('q') || '').trim();
    if (!q) return NextResponse.json({ popular: await searchSuggestions(viewer.userId) });
    const offset = Math.max(0, Math.floor(Number(sp.get('offset')) || 0));
    const limit = Math.min(40, Math.max(1, Math.floor(Number(sp.get('limit')) || 20)));
    return NextResponse.json(await searchVideos(viewer.userId, q, offset, limit));
  } catch (e) {
    console.error('mitttv search error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
