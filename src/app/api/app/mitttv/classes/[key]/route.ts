import { NextResponse } from 'next/server';
import { requireMittTvViewer } from '@/lib/mittTv';
import { erpClassPage, erpOffResponse } from '@/lib/mittTvErp';

export const dynamic = 'force-dynamic';

// GET /api/app/mitttv/classes/:key (PG, NURSERY, LKG, UKG, 1…12) — one class of
// "Learn by Class", read live from the ERP: { class: { key, label },
// totals: { books, videos }, series: [{ id, name, books: [{ id, name, subject,
// posterUrl, thumbnailUrl, chapters, videos }] }] }.
export async function GET(request: Request, { params }: { params: Promise<{ key: string }> }) {
  const viewer = await requireMittTvViewer(request);
  if (viewer.error) return viewer.error;
  const off = await erpOffResponse();
  if (off) return off;
  try {
    const { key } = await params;
    const data = await erpClassPage(decodeURIComponent(key).toUpperCase());
    if (!data || data.series.length === 0) return NextResponse.json({ error: 'No videos for this class yet' }, { status: 404 });
    return NextResponse.json(data);
  } catch (e) {
    console.error('mitttv class error:', e);
    return NextResponse.json({ error: 'Class videos could not be loaded. Please try again.' }, { status: 503 });
  }
}
