import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth-guard';

// GET /api/dashboard/student-activity/usage?days=1|7|30|90
// App usage for Reports → User Activity, from AppUsageSession (sent by the
// app's usage tracker). Days and hours are India time (IST); "1" = today
// since midnight IST. A session is counted on the day/hour it STARTED.
// "Users" = distinct accounts, plus distinct devices for guest sessions.

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const ALLOWED_DAYS = new Set([1, 7, 30, 90]);

// Midnight IST, `daysBack` days before today.
function istMidnight(daysBack: number): Date {
  const istNow = Date.now() + IST_OFFSET_MS;
  const istDayStart = Math.floor(istNow / 86_400_000) * 86_400_000;
  return new Date(istDayStart - daysBack * 86_400_000 - IST_OFFSET_MS);
}

const n = (v: unknown) => Number(v ?? 0);

export async function GET(request: Request) {
  const { error } = await requireAdmin(request, 'reports.student-activity');
  if (error) return error;

  const daysParam = Number(new URL(request.url).searchParams.get('days') ?? 7);
  const days = ALLOWED_DAYS.has(daysParam) ? daysParam : 7;
  const from = istMidnight(days - 1);
  const to = new Date(Date.now() + 60_000);

  try {
    const [totals, daily, hourly, perUser, platforms] = await Promise.all([
      prisma.$queryRaw<{ sessions: number; users: number; accounts: number; guests: number; active: number; idle: number }[]>`
        SELECT COUNT(*)::int AS sessions,
               COUNT(DISTINCT COALESCE("appUserId", 'device:' || "deviceId"))::int AS users,
               COUNT(DISTINCT "appUserId")::int AS accounts,
               COUNT(DISTINCT CASE WHEN "appUserId" IS NULL THEN "deviceId" END)::int AS guests,
               COALESCE(SUM("activeSeconds"), 0)::float8 AS active,
               COALESCE(SUM("idleSeconds"), 0)::float8 AS idle
        FROM "public"."AppUsageSession"
        WHERE "startedAt" >= ${from} AND "startedAt" < ${to}`,
      prisma.$queryRaw<{ day: string; sessions: number; users: number; active: number }[]>`
        SELECT to_char(("startedAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') AS day,
               COUNT(*)::int AS sessions,
               COUNT(DISTINCT COALESCE("appUserId", 'device:' || "deviceId"))::int AS users,
               COALESCE(SUM("activeSeconds"), 0)::float8 AS active
        FROM "public"."AppUsageSession"
        WHERE "startedAt" >= ${from} AND "startedAt" < ${to}
        GROUP BY 1 ORDER BY 1`,
      prisma.$queryRaw<{ hour: number; sessions: number; users: number; active: number }[]>`
        SELECT EXTRACT(HOUR FROM ("startedAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kolkata')::int AS hour,
               COUNT(*)::int AS sessions,
               COUNT(DISTINCT COALESCE("appUserId", 'device:' || "deviceId"))::int AS users,
               COALESCE(SUM("activeSeconds"), 0)::float8 AS active
        FROM "public"."AppUsageSession"
        WHERE "startedAt" >= ${from} AND "startedAt" < ${to}
        GROUP BY 1 ORDER BY 1`,
      prisma.$queryRaw<{ appUserId: string; sessions: number; active: number; idle: number; lastSeen: Date }[]>`
        SELECT "appUserId",
               COUNT(*)::int AS sessions,
               COALESCE(SUM("activeSeconds"), 0)::float8 AS active,
               COALESCE(SUM("idleSeconds"), 0)::float8 AS idle,
               MAX("endedAt") AS "lastSeen"
        FROM "public"."AppUsageSession"
        WHERE "startedAt" >= ${from} AND "startedAt" < ${to} AND "appUserId" IS NOT NULL
        GROUP BY 1`,
      prisma.$queryRaw<{ platform: string; sessions: number; users: number }[]>`
        SELECT "platform",
               COUNT(*)::int AS sessions,
               COUNT(DISTINCT COALESCE("appUserId", 'device:' || "deviceId"))::int AS users
        FROM "public"."AppUsageSession"
        WHERE "startedAt" >= ${from} AND "startedAt" < ${to}
        GROUP BY 1 ORDER BY 2 DESC`,
    ]);

    // Every day of the range, including days with no sessions.
    const byDay = new Map(daily.map(d => [d.day, d]));
    const dayList = Array.from({ length: days }, (_, i) => {
      const key = new Date(from.getTime() + IST_OFFSET_MS + i * 86_400_000).toISOString().slice(0, 10);
      const d = byDay.get(key);
      return { day: key, sessions: n(d?.sessions), users: n(d?.users), activeSeconds: n(d?.active) };
    });
    const byHour = new Map(hourly.map(h => [n(h.hour), h]));
    const hourList = Array.from({ length: 24 }, (_, hour) => {
      const h = byHour.get(hour);
      return { hour, sessions: n(h?.sessions), users: n(h?.users), activeSeconds: n(h?.active) };
    });

    const t = totals[0];
    return NextResponse.json({
      days,
      from: from.toISOString(),
      totals: {
        sessions: n(t?.sessions),
        users: n(t?.users),
        accounts: n(t?.accounts),
        guests: n(t?.guests),
        activeSeconds: n(t?.active),
        idleSeconds: n(t?.idle),
      },
      daily: dayList,
      hourly: hourList,
      platforms: platforms.map(p => ({ platform: p.platform, sessions: n(p.sessions), users: n(p.users) })),
      users: perUser.map(u => ({
        appUserId: u.appUserId,
        sessions: n(u.sessions),
        activeSeconds: n(u.active),
        idleSeconds: n(u.idle),
        lastSeen: u.lastSeen,
      })),
    });
  } catch (e) {
    console.error('GET /api/dashboard/student-activity/usage failed:', e);
    return NextResponse.json({ message: 'Failed to load app usage' }, { status: 500 });
  }
}
