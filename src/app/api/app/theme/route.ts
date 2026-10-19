import { NextResponse } from 'next/server';
import { getLiveTheme } from '@/lib/appTheme';

export const dynamic = 'force-dynamic';

// GET /api/app/theme — public (the app asks before anyone logs in, and the
// theme is the same for everyone). Returns the live festival theme, or
// `theme: null` for the app's built-in look.
//
// Kept cheap because every launch asks: answered from an in-memory cache
// (lib/appTheme.ts), and the app sends back the ETag it already has, so the
// usual reply is an empty 304. The app never waits on this — it shows the
// theme it cached last time and swaps in a new one when it arrives.
export async function GET(request: Request) {
  try {
    const live = await getLiveTheme();
    const headers = {
      ETag: live.etag,
      'Cache-Control': 'public, max-age=30, s-maxage=30, stale-while-revalidate=300',
    };
    if (request.headers.get('if-none-match') === live.etag) {
      return new NextResponse(null, { status: 304, headers });
    }
    return NextResponse.json(
      { theme: live.theme, nextChangeAt: live.nextChangeAt, serverTime: new Date().toISOString() },
      { headers },
    );
  } catch (e) {
    console.error('GET /api/app/theme failed:', e);
    // The app keeps whatever it had (or its built-in look) on any error.
    return NextResponse.json({ message: 'Unavailable' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
