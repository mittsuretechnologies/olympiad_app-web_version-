import { prisma } from '@/lib/prisma';
import { sendDailyVideoReportEmail, renderDailyVideoReportText, DailyVideoReportMail } from '@/lib/mailer';

// Daily internal report of Mittmee videos, emailed at a fixed IST time.
// Configured through DAILY_REPORT_EMAILS / DAILY_REPORT_TIME in the environment.
// Sent by the in-app scheduler (src/instrumentation.ts),
// which calls runDailyReportIfDue() every minute. Soft-deleted videos are not
// counted.

const KEYS = {
  lastSent: 'DAILY_REPORT_LAST_SENT',   // IST date "YYYY-MM-DD" of the last scheduled send
  lastError: 'DAILY_REPORT_LAST_ERROR',
} as const;

export const DEFAULT_REPORT_TIME = '18:00';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const EMAIL_RE = /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/;

export interface DailyReportSettings {
  enabled: boolean;
  emails: string[];
  time: string;
  lastSent: string | null;
  lastError: string | null;
}

export type DailyVideoReport = Omit<DailyVideoReportMail, 'to'>;

/** "now" shifted to IST, read with getUTC* methods. */
const toIst = (d: Date) => new Date(d.getTime() + IST_OFFSET_MS);
const pad = (n: number) => String(n).padStart(2, '0');
const istDateKey = (d: Date) => {
  const i = toIst(d);
  return `${i.getUTCFullYear()}-${pad(i.getUTCMonth() + 1)}-${pad(i.getUTCDate())}`;
};
const istDate = (d: Date) =>
  d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
const istTime = (d: Date) =>
  d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }).toUpperCase();

export function parseEmails(input: string | string[]): string[] {
  const list = Array.isArray(input) ? input : input.split(/[\s,;]+/);
  return [...new Set(list.map(e => e.trim().toLowerCase()).filter(Boolean))];
}

export function invalidEmails(emails: string[]): string[] {
  return emails.filter(e => !EMAIL_RE.test(e));
}

// Recipients and time come from the environment (DAILY_REPORT_EMAILS,
// DAILY_REPORT_TIME); the report is on whenever at least one email is set.
// Only the send bookkeeping (lastSent / lastError) lives in AppSetting.
export async function getDailyReportSettings(): Promise<DailyReportSettings> {
  const rows = await prisma.appSetting.findMany({ where: { key: { in: [KEYS.lastSent, KEYS.lastError] } } });
  const get = (k: string) => rows.find(r => r.key === k)?.value ?? '';
  const emails = parseEmails(process.env.DAILY_REPORT_EMAILS ?? '');
  const time = (process.env.DAILY_REPORT_TIME ?? '').trim();
  return {
    enabled:   emails.length > 0,
    emails,
    time:      /^([01]\d|2[0-3]):[0-5]\d$/.test(time) ? time : DEFAULT_REPORT_TIME,
    lastSent:  get(KEYS.lastSent) || null,
    lastError: get(KEYS.lastError) || null,
  };
}

/**
 * The "Today" lines cover report time to report time (e.g. 6 PM yesterday to
 * 6 PM today), not midnight to midnight: the report goes out in the evening,
 * so a midnight start would leave uploads made after it out of every report.
 * The window always ends at today's report time (or now, if that is still
 * ahead), so a late send does not shift where the next day's window starts.
 */
export function reportWindow(now: Date, time: string): { start: Date; end: Date } {
  const i = toIst(now);
  const [h, m] = time.split(':').map(Number);
  const todayAt = new Date(Date.UTC(i.getUTCFullYear(), i.getUTCMonth(), i.getUTCDate(), h, m) - IST_OFFSET_MS);
  return { start: new Date(todayAt.getTime() - 24 * 60 * 60 * 1000), end: now < todayAt ? now : todayAt };
}

export async function buildDailyVideoReport(now = new Date(), time = DEFAULT_REPORT_TIME): Promise<DailyVideoReport> {
  const { start, end } = reportWindow(now, time);

  const live = { deletedAt: null };
  const [total, today, [{ todayRejected }], byStatus, pendingVideos] = await Promise.all([
    prisma.video.count({ where: live }),
    prisma.video.count({ where: { ...live, createdAt: { gte: start, lt: end } } }),
    // Still-rejected videos whose latest rejection falls in the window, from the
    // audit log: updatedAt also moves on edits that are not a rejection.
    prisma.$queryRaw<{ todayRejected: number }[]>`
      SELECT count(*)::int AS "todayRejected" FROM (
        SELECT (SELECT max(a."createdAt") FROM public."AuditLog" a
                WHERE a."entityType" = 'Video' AND a."entityId" = v.id AND a.action = 'VIDEO_REJECTED') AS "rejectedAt"
        FROM public."Video" v
        WHERE v."deletedAt" IS NULL AND v.status = 'REJECTED'
      ) r
      WHERE r."rejectedAt" >= ${start} AND r."rejectedAt" < ${end}`,
    prisma.video.groupBy({ by: ['status'], where: live, _count: { _all: true } }),
    prisma.video.findMany({
      where: { ...live, status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    }),
  ]);
  const countOf = (status: string) => byStatus.find(s => s.status === status)?._count._all ?? 0;

  return {
    dateLabel: istDate(end),
    windowLabel: `${istDate(start)}, ${istTime(start)} – ${istDate(end)}, ${istTime(end)}`,
    total,
    today,
    approved: countOf('APPROVED'),
    todayRejected,
    pending:  countOf('PENDING'),
    pendingUploadedAt: pendingVideos.map(v => `${istDate(v.createdAt)}, ${istTime(v.createdAt)}`),
  };
}

export function dailyVideoReportText(report: DailyVideoReport): string {
  return renderDailyVideoReportText({ ...report, to: [] });
}

export async function sendDailyVideoReport(to: string[], now = new Date(), time = DEFAULT_REPORT_TIME): Promise<DailyVideoReport> {
  const report = await buildDailyVideoReport(now, time);
  await sendDailyVideoReportEmail({ ...report, to });
  return report;
}

/**
 * Sends today's report if it is on, the configured IST time has passed, and it
 * has not gone out yet today. Several app instances may call this at once, so
 * the day is claimed atomically first: only the caller whose upsert actually
 * changes DAILY_REPORT_LAST_SENT sends. A failed send is not retried (that would
 * repeat every minute); the error is shown on the settings page instead.
 */
export async function runDailyReportIfDue(now = new Date()): Promise<boolean> {
  const settings = await getDailyReportSettings();
  if (!settings.enabled || settings.emails.length === 0) return false;

  const i = toIst(now);
  if (`${pad(i.getUTCHours())}:${pad(i.getUTCMinutes())}` < settings.time) return false;

  const today = istDateKey(now);
  if (settings.lastSent === today) return false;

  const claimed = await prisma.$queryRaw<{ key: string }[]>`
    INSERT INTO public."AppSetting" (key, value, "updatedAt")
    VALUES (${KEYS.lastSent}, ${today}, now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, "updatedAt" = now()
    WHERE public."AppSetting".value <> EXCLUDED.value
    RETURNING key`;
  if (claimed.length === 0) return false;

  let error = '';
  try {
    await sendDailyVideoReport(settings.emails, now, settings.time);
  } catch (e: any) {
    error = `${istDate(now)} ${istTime(now)}: ${e?.message || 'Could not send'}`;
    console.error('daily video report send failed:', e);
  }
  await prisma.appSetting.upsert({
    where:  { key: KEYS.lastError },
    update: { value: error },
    create: { key: KEYS.lastError, value: error },
  });
  return !error;
}
