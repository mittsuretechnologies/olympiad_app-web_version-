import { prisma } from '@/lib/prisma';
import { sendDailyVideoReportEmail, renderDailyVideoReportText, DailyVideoReportMail } from '@/lib/mailer';

// Daily internal report of Mittmee videos, emailed at a fixed IST time.
// Configured by the SuperAdmin in Dashboard → Settings → Daily Report and
// stored in AppSetting. Sent by the in-app scheduler (src/instrumentation.ts),
// which calls runDailyReportIfDue() every minute. Soft-deleted videos are not
// counted.

const KEYS = {
  enabled:   'DAILY_REPORT_ENABLED',
  emails:    'DAILY_REPORT_EMAILS',
  time:      'DAILY_REPORT_TIME',        // "HH:MM", 24-hour, IST
  lastSent:  'DAILY_REPORT_LAST_SENT',   // IST date "YYYY-MM-DD" of the last scheduled send
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

export async function getDailyReportSettings(): Promise<DailyReportSettings> {
  const rows = await prisma.appSetting.findMany({ where: { key: { in: Object.values(KEYS) } } });
  const get = (k: string) => rows.find(r => r.key === k)?.value ?? '';
  const time = get(KEYS.time);
  return {
    enabled:   get(KEYS.enabled) === 'true',
    emails:    parseEmails(get(KEYS.emails)),
    time:      /^\d{2}:\d{2}$/.test(time) ? time : DEFAULT_REPORT_TIME,
    lastSent:  get(KEYS.lastSent) || null,
    lastError: get(KEYS.lastError) || null,
  };
}

export async function setDailyReportSettings(input: { enabled: boolean; emails: string[]; time: string }) {
  const values: Record<string, string> = {
    [KEYS.enabled]: input.enabled ? 'true' : 'false',
    [KEYS.emails]:  input.emails.join(','),
    [KEYS.time]:    input.time,
  };
  await prisma.$transaction(
    Object.entries(values).map(([key, value]) =>
      prisma.appSetting.upsert({ where: { key }, update: { value }, create: { key, value } }),
    ),
  );
  return getDailyReportSettings();
}

export async function buildDailyVideoReport(now = new Date()): Promise<DailyVideoReport> {
  const i = toIst(now);
  const dayStart = new Date(Date.UTC(i.getUTCFullYear(), i.getUTCMonth(), i.getUTCDate()) - IST_OFFSET_MS);

  const live = { deletedAt: null };
  const [total, today, byStatus, pendingVideos] = await Promise.all([
    prisma.video.count({ where: live }),
    prisma.video.count({ where: { ...live, createdAt: { gte: dayStart } } }),
    prisma.video.groupBy({ by: ['status'], where: live, _count: { _all: true } }),
    prisma.video.findMany({
      where: { ...live, status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    }),
  ]);
  const countOf = (status: string) => byStatus.find(s => s.status === status)?._count._all ?? 0;

  return {
    dateLabel: istDate(now),
    timeLabel: istTime(now),
    total,
    today,
    approved: countOf('APPROVED'),
    rejected: countOf('REJECTED'),
    pending:  countOf('PENDING'),
    pendingUploadedAt: pendingVideos.map(v => `${istDate(v.createdAt)}, ${istTime(v.createdAt)}`),
  };
}

export function dailyVideoReportText(report: DailyVideoReport): string {
  return renderDailyVideoReportText({ ...report, to: [] });
}

export async function sendDailyVideoReport(to: string[], now = new Date()): Promise<DailyVideoReport> {
  const report = await buildDailyVideoReport(now);
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
    await sendDailyVideoReport(settings.emails, now);
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
