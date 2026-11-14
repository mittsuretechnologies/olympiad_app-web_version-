import { NextResponse } from 'next/server';
import { IOS_BUNDLE_ID } from '@/lib/shareLink';

export const dynamic = 'force-dynamic';

// iOS Universal Links verification. Set APPLE_TEAM_ID on the server.
export function GET() {
  const appID = `${process.env.APPLE_TEAM_ID || 'TEAMID'}.${IOS_BUNDLE_ID}`;
  return NextResponse.json({
    applinks: { apps: [], details: [{ appIDs: [appID], components: [{ '/': '/v/*' }] }] },
  });
}
