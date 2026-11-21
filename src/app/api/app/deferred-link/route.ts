import { NextResponse } from 'next/server';
import { clientIp } from '@/lib/agreements/server';
import { claimShareClick, type SharePlatform } from '@/lib/deferredLink';

export const dynamic = 'force-dynamic';

// Asked once by a freshly installed app (no login needed): "did this phone
// just tap a shared-video link?" Returns { videoId } or { videoId: null }.
// See lib/deferredLink.ts.
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const platform: SharePlatform | null =
      body?.platform === 'ios' || body?.platform === 'android' ? body.platform : null;
    const videoId = await claimShareClick(clientIp(request), platform);
    return NextResponse.json({ videoId });
  } catch (e: any) {
    console.error('[deferred-link] claim failed:', e?.message || e);
    return NextResponse.json({ videoId: null });
  }
}
