import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { loadPublicCategories } from '@/lib/uploadCategories';

export const dynamic = 'force-dynamic';

// GET /api/app/categories — the categories the SuperAdmin manages, for the
// app (Upload, Search, Reels filter) and the school portal's upload page.
// Every category comes back, open for uploads or not (isActive), with only
// the options that are switched on; each says who may upload into it
// (audiences), its Olympiad slot (slotKind) and its Search / Home settings.
// Public: nothing in it is private.
//
// Answered with an ETag, so the app's usual refresh is an empty 304.
export async function GET(request: Request) {
  try {
    const categories = await loadPublicCategories();
    const body = JSON.stringify({ categories });
    const etag = `"${createHash('sha1').update(body).digest('hex').slice(0, 16)}"`;
    const headers = { ETag: etag, 'Cache-Control': 'no-cache' };
    if (request.headers.get('if-none-match') === etag) return new NextResponse(null, { status: 304, headers });
    return new NextResponse(body, { headers: { ...headers, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('GET /api/app/categories failed:', e);
    // The app keeps its last copy (or its built-in lists) on any error.
    return NextResponse.json({ message: 'Unavailable' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
