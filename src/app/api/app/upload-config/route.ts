import { NextResponse } from 'next/server';
import { isMittfestCheckboxEnabled } from '@/lib/mittfestSettings';

export const dynamic = 'force-dynamic';

// GET /api/app/upload-config — public. Read by the app's upload screen to
// decide which optional fields to show. Today that's only the MittFest
// checkbox, which a SuperAdmin turns on or off from Settings → MittFest.
export async function GET() {
  try {
    return NextResponse.json(
      { showMittfestCheckbox: await isMittfestCheckboxEnabled() },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    console.error('upload-config error:', e);
    return NextResponse.json({ message: 'Unavailable' }, { status: 500 });
  }
}
