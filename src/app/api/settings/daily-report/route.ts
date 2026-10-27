import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth-guard';
import { recordAuditLog } from '@/lib/audit-log';
import { isMailerConfigured } from '@/lib/mailer';
import {
  getDailyReportSettings, setDailyReportSettings, buildDailyVideoReport,
  dailyVideoReportText, parseEmails, invalidEmails,
} from '@/lib/dailyVideoReport';

export const dynamic = 'force-dynamic';

// GET / POST /api/settings/daily-report — SuperAdmin only. Settings for the
// daily video report email (see lib/dailyVideoReport.ts). GET also returns the
// report as it stands right now, for the preview on the settings page.
export async function GET(request: Request) {
  const { error } = requireRole(request, ['SUPERADMIN']);
  if (error) return error;

  const [settings, report] = await Promise.all([getDailyReportSettings(), buildDailyVideoReport()]);
  return NextResponse.json({
    settings,
    mailerConfigured: isMailerConfigured(),
    preview: dailyVideoReportText(report),
  });
}

export async function POST(request: Request) {
  const { error, payload } = requireRole(request, ['SUPERADMIN']);
  if (error) return error;

  try {
    const body = await request.json();
    const enabled = body.enabled === true;
    const emails = parseEmails(Array.isArray(body.emails) ? body.emails.map(String) : String(body.emails ?? ''));
    const time = String(body.time ?? '');

    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
      return NextResponse.json({ message: 'Pick a valid time' }, { status: 400 });
    }
    const bad = invalidEmails(emails);
    if (bad.length) {
      return NextResponse.json({ message: `Not a valid email: ${bad.join(', ')}` }, { status: 400 });
    }
    if (enabled && emails.length === 0) {
      return NextResponse.json({ message: 'Add at least one email before turning the report on' }, { status: 400 });
    }

    const before = await getDailyReportSettings();
    const saved = await setDailyReportSettings({ enabled, emails, time });

    await recordAuditLog({
      actorId: payload!.id,
      actorRole: payload!.role,
      actorName: payload!.name || payload!.email || null,
      action: 'DAILY_REPORT_SETTINGS_CHANGED',
      entityType: 'AppSetting',
      entityId: 'daily-report',
      previousValue: { enabled: before.enabled, emails: before.emails, time: before.time },
      newValue: { enabled: saved.enabled, emails: saved.emails, time: saved.time },
    });

    return NextResponse.json({ settings: saved });
  } catch (e: any) {
    return NextResponse.json({ message: e.message || 'Could not save' }, { status: 500 });
  }
}
