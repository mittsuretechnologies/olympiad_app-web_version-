import { NextResponse } from 'next/server';
import { accessFor, appUserIdFrom } from '@/lib/mittTv';

export const dynamic = 'force-dynamic';

// GET /api/app/mitttv/config — whether this user gets the MittTV button on
// Home, and its label. Cheap: the app asks every time Home comes into view.
export async function GET(request: Request) {
  const userId = appUserIdFrom(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { allowed, settings } = await accessFor(userId);
    return NextResponse.json({
      enabled: allowed,
      buttonLabel: settings.buttonLabel,
      screenTitle: settings.screenTitle,
      searchEnabled: settings.searchEnabled,
    });
  } catch (e) {
    console.error('mitttv config error:', e);
    // A failure hides the button rather than showing one that can't open.
    return NextResponse.json({ enabled: false }, { status: 500 });
  }
}
