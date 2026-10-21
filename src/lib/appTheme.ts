import { createHash } from 'crypto';
import { prisma } from '@/lib/prisma';
import { normalizeThemeConfig, type AppThemeConfig } from '@/lib/appThemeConfig';

// Which AppTheme is live right now, for GET /api/app/theme and the home
// feed's festival carousel slides.
//
// Live = isActive AND (startsAt null or <= now) AND (endsAt null or > now).
// Several live at once (e.g. a month-long "Festive season" plus a one-day
// "Diwali" on top): highest priority wins, then the most recently started.
//
// Asked on every app launch and every home-feed load, so the answer is kept
// in memory for CACHE_MS — but never past the next scheduled switch, so a
// theme still starts/ends on the minute. Dashboard writes call
// invalidateLiveTheme() so changes show up on this instance immediately.

const CACHE_MS = 30_000;
// Bump when the theme payload gains fields (festive top, splash, artwork …).
// It's part of the ETag, so phones holding an older copy re-download once
// instead of being told "unchanged" and never seeing the new fields.
const CONFIG_FORMAT = 'v4-splash-art';

export interface PublicTheme {
  id: string;
  name: string;
  startsAt: string | null;
  endsAt: string | null;
  updatedAt: string;
  config: AppThemeConfig;
}

export interface LiveTheme {
  theme: PublicTheme | null;
  // Next moment the answer can change on its own (live one ends, or a
  // scheduled one starts). The app re-asks then instead of polling.
  nextChangeAt: string | null;
  etag: string;
}

let cache: { value: LiveTheme; expiresAt: number } | null = null;
let inflight: Promise<LiveTheme> | null = null;
// Bumped on every invalidate, so a query that was already running when the
// SuperAdmin saved can't put its (now stale) answer back into the cache.
let generation = 0;

export function invalidateLiveTheme() {
  cache = null;
  inflight = null;
  generation += 1;
}

// Images uploaded without S3 are stored as `${SERVER_URL}/uploads/…` — on a
// dev machine that's http://localhost:3000, which a phone/emulator can't
// reach (its "localhost" is itself). Sent to the app as a bare path instead,
// and the app prefixes the server address it already talks to. S3/CDN URLs
// are left untouched.
function portableUrl(url: string): string {
  if (!url) return url;
  try {
    const u = new URL(url);
    let own = '';
    try { own = process.env.SERVER_URL ? new URL(process.env.SERVER_URL).origin : ''; } catch { /* unset/invalid */ }
    const local = ['localhost', '127.0.0.1', '0.0.0.0'].includes(u.hostname);
    return local || u.origin === own ? `${u.pathname}${u.search}` : url;
  } catch {
    return url;
  }
}

export function toPublicTheme(row: {
  id: string; name: string; startsAt: Date | null; endsAt: Date | null; updatedAt: Date; config: unknown;
}, { forApp = false }: { forApp?: boolean } = {}): PublicTheme {
  // Copied: on a bad row normalizeThemeConfig returns the shared defaults object.
  const config = structuredClone(normalizeThemeConfig(row.config));
  if (forApp) {
    config.greeting.imageUrl = portableUrl(config.greeting.imageUrl);
    config.background.imageUrl = portableUrl(config.background.imageUrl);
    config.splash.imageUrl = portableUrl(config.splash.imageUrl);
  }
  return {
    id: row.id,
    name: row.name,
    startsAt: row.startsAt?.toISOString() ?? null,
    endsAt: row.endsAt?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
    config,
  };
}

async function resolve(now: Date): Promise<LiveTheme> {
  const [live, upcoming] = await Promise.all([
    prisma.appTheme.findFirst({
      where: {
        isActive: true,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
        ],
      },
      orderBy: [{ priority: 'desc' }, { startsAt: { sort: 'desc', nulls: 'last' } }, { updatedAt: 'desc' }],
    }),
    prisma.appTheme.findFirst({
      where: { isActive: true, startsAt: { gt: now } },
      orderBy: { startsAt: 'asc' },
      select: { startsAt: true },
    }),
  ]);

  const candidates = [live?.endsAt, upcoming?.startsAt].filter((d): d is Date => !!d);
  const next = candidates.length ? new Date(Math.min(...candidates.map((d) => d.getTime()))) : null;
  const theme = live ? toPublicTheme(live, { forApp: true }) : null;
  const etag = `"${createHash('sha1')
    .update(`${CONFIG_FORMAT}|${theme?.id ?? 'none'}|${theme?.updatedAt ?? ''}|${next?.toISOString() ?? ''}`)
    .digest('base64url')}"`;

  return { theme, nextChangeAt: next?.toISOString() ?? null, etag };
}

export async function getLiveTheme(): Promise<LiveTheme> {
  const nowMs = Date.now();
  if (cache && cache.expiresAt > nowMs) return cache.value;
  // Collapse a burst of cold requests (app launch spike) into one query.
  if (inflight) return inflight;

  const gen = generation;
  const p: Promise<LiveTheme> = resolve(new Date(nowMs))
    .then((value) => {
      if (gen === generation) {
        const nextMs = value.nextChangeAt ? new Date(value.nextChangeAt).getTime() : Infinity;
        cache = { value, expiresAt: Math.min(nowMs + CACHE_MS, nextMs) };
      }
      return value;
    })
    .finally(() => { if (inflight === p) inflight = null; });
  inflight = p;
  return p;
}
