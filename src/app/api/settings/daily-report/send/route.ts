import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth-guard';
import { getDailyReportSettings, sendDailyVideoReport } from '@/lib/dailyVideoReport';

export const dynamic = 'force-dynamic';

// POST /api/settings/daily-report/send — SuperAdmin only. Emails the report
// right now to the saved addresses. Does not count as the day's scheduled send,
// so the report still goes out at the set time.
export async function POST(request: Request) {
  const { error } = requireRole(request, ['SUPERADMIN']);
  if (error) return error;

  const { emails } = await getDailyReportSettings();
  if (emails.length === 0) {
    return NextResponse.json({ message: 'Save at least one email first' }, { status: 400 });
  }

  try {
    await sendDailyVideoReport(emails);
    return NextResponse.json({ sentTo: emails });
  } catch (e: any) {
    return NextResponse.json({ message: e.message || 'Could not send' }, { status: 500 });
  }
}
