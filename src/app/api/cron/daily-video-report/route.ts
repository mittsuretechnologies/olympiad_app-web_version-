import { NextResponse } from 'next/server';
import { runDailyReportIfDue } from '@/lib/dailyVideoReport';

export const dynamic = 'force-dynamic';

// Backup trigger for the daily video report. The app already sends it on its
// own (src/instrumentation.ts); this exists for setups where the in-app
// scheduler does not run. It obeys the same settings (DAILY_REPORT_EMAILS /
// DAILY_REPORT_TIME) and never sends twice in a day, so calling it more often is safe.
//
// Call it from the server's crontab with CRON_SECRET as a Bearer token,
// like /api/cron/infringement-reviews.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    return NextResponse.json({ sent: await runDailyReportIfDue() });
  } catch (error: any) {
    console.error('daily-video-report cron error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
