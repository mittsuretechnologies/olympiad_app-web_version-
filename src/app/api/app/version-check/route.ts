import { NextResponse } from 'next/server';
import { androidStoreUrls, getAppVersionSettings } from '@/lib/appVersion';

export const dynamic = 'force-dynamic';

// GET /api/app/version-check — public (the app asks before anyone logs in).
// Returns the minimum build each platform must be on; an app below it shows a
// blocking "Update required" screen. The app lets the user in if this request
// fails, so a server problem can never lock everyone out.
export async function GET() {
  try {
    const s = await getAppVersionSettings();
    return NextResponse.json(
      {
        android: { minBuild: s.androidMinBuild, ...androidStoreUrls() },
        ios: { minBuild: s.iosMinBuild, storeUrl: s.iosStoreUrl, webUrl: s.iosStoreUrl },
        message: s.message,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    console.error('version-check error:', e);
    return NextResponse.json({ message: 'Unavailable' }, { status: 500 });
  }
}
