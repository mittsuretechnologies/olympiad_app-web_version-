import { NextResponse } from 'next/server';
import { requireMittTvViewer } from '@/lib/mittTv';
import { erpBookPage, erpOffResponse } from '@/lib/mittTvErp';

export const dynamic = 'force-dynamic';

// GET /api/app/mitttv/books/:id — one ERP book for "Learn by Class", read live:
// { book, languages: [{ key, label }], chapters: [{ id, no, name, description,
// videos: [{ id, language, label, title }] }] }. A video then opens with
// /api/app/mitttv/videos/:id like any other.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireMittTvViewer(request);
  if (viewer.error) return viewer.error;
  const off = await erpOffResponse();
  if (off) return off;
  try {
    const { id } = await params;
    const data = await erpBookPage(id);
    if (!data || data.chapters.length === 0) return NextResponse.json({ error: 'This book has no videos right now' }, { status: 404 });
    return NextResponse.json(data);
  } catch (e) {
    console.error('mitttv book error:', e);
    return NextResponse.json({ error: 'This book could not be loaded. Please try again.' }, { status: 503 });
  }
}
