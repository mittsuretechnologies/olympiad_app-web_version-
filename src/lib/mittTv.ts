import path from 'path';
import os from 'os';
import { randomUUID } from 'crypto';
import { mkdir, readFile, stat, unlink, writeFile } from 'fs/promises';
import { NextResponse } from 'next/server';
import { verify } from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { getJwtSecret } from '@/lib/jwt-secret';
import { deleteFromS3, downloadFromS3, s3Enabled, s3KeyFromUrl, uploadBufferToS3 } from '@/lib/s3';
import { extractThumbnail } from '@/lib/videoProbe';
import {
  DEFAULT_SETTINGS, MITTTV_LIMITS, ROW_DEFAULTS, SEE_ALL_KINDS, cleanRowSettings, isRowKind, parseSettings,
  videoDetailsFromMeta, videoNotesFromMeta, type MittTvAudience, type MittTvSettings, type RowSettings,
} from '@/lib/mittTvShared';

// MittTV, server side: settings, the screen's rows, Continue Watching, views
// and the media files. Shared rules and choices: mittTvShared.ts. Tables:
// prisma/manual-migrations/2026-11-17-mitttv.sql.
//
// Videos uploaded in the dashboard have source UPLOAD. The class & subject
// platform is meant to come in later as another source: its videos go into
// MittTvVideo with their own source / externalId (so views, progress, the
// banner and hand-picked rows work for them unchanged), and its class/subject
// browser becomes a new row kind. Nothing here needs to change for that.

const SETTINGS_KEY = 'MITTTV';
const SEEDED_KEY = 'MITTTV_SEEDED';
export const MITTTV_MEDIA_PREFIX = 'uploads/mitttv/';
const NEW_BADGE_DAYS = 14;

// The dev server gives each route its own copy of this module, so the caches
// live on globalThis (same as the upload categories).
type Cache = {
  settings?: { at: number; value: MittTvSettings };
  most: Map<string, { at: number; ids: string[] }>;
  seeding?: Promise<void>;
};
const g = globalThis as unknown as { __mittTv?: Cache };
const cache: Cache = (g.__mittTv ??= { most: new Map() });
const SETTINGS_TTL = 30_000;
const MOST_TTL = 5 * 60_000;

export function clearMittTvCache() {
  cache.settings = undefined;
  cache.most.clear();
}

// ── Settings ─────────────────────────────────────────────────────────────────

export async function loadSettings(): Promise<MittTvSettings> {
  if (cache.settings && Date.now() - cache.settings.at < SETTINGS_TTL) return cache.settings.value;
  const row = await prisma.appSetting.findUnique({ where: { key: SETTINGS_KEY } });
  const value = parseSettings(row?.value);
  cache.settings = { at: Date.now(), value };
  return value;
}

export async function saveSettings(value: MittTvSettings): Promise<MittTvSettings> {
  const json = JSON.stringify(value);
  await prisma.appSetting.upsert({ where: { key: SETTINGS_KEY }, update: { value: json }, create: { key: SETTINGS_KEY, value: json } });
  cache.settings = { at: Date.now(), value };
  return value;
}

/** Which of the four kinds of app user this is (same split as App Notifications). */
export async function audienceOf(appUserId: string): Promise<MittTvAudience | null> {
  const u = await prisma.appUser.findUnique({
    where: { id: appUserId },
    select: { olympiadId: true, accountType: true, schoolRefId: true },
  });
  if (!u) return null;
  if (u.schoolRefId) return 'OLYMPIAD_SCHOOL';
  if (u.accountType === 'SCHOOL') return 'GENERAL_SCHOOL';
  if (u.olympiadId) return 'OLYMPIAD_STUDENT';
  return 'NORMAL';
}

/** Whether MittTV is on for this user, with the settings. */
export async function accessFor(appUserId: string): Promise<{ allowed: boolean; settings: MittTvSettings }> {
  const settings = await loadSettings();
  if (!settings.enabled) return { allowed: false, settings };
  const audience = await audienceOf(appUserId);
  return { allowed: !!audience && settings.audiences.includes(audience), settings };
}

/** The app user id from the request's token, or null. */
export function appUserIdFrom(request: Request): string | null {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  try {
    const decoded = verify(auth.slice(7), getJwtSecret()) as any;
    return decoded?.role === 'APP_USER' && decoded.id ? String(decoded.id) : null;
  } catch {
    return null;
  }
}

type ViewerCheck =
  | { userId: string; settings: MittTvSettings; error?: undefined }
  | { userId?: undefined; settings?: undefined; error: NextResponse };

/** For the app's MittTV routes: a logged-in app user for whom MittTV is switched on. */
export async function requireMittTvViewer(request: Request): Promise<ViewerCheck> {
  const userId = appUserIdFrom(request);
  if (!userId) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const { allowed, settings } = await accessFor(userId);
  if (!allowed) {
    return { error: NextResponse.json({ error: 'MittTV is not available right now', code: 'MITTTV_OFF' }, { status: 403 }) };
  }
  return { userId, settings };
}

// ── Default rows ─────────────────────────────────────────────────────────────

const DEFAULT_ROWS: { title: string; kind: string; style: string; settings: RowSettings }[] = [
  { title: 'Most Watched', kind: 'BANNER', style: 'LANDSCAPE', settings: cleanRowSettings('BANNER', {}) },
  { title: 'Continue Watching', kind: 'CONTINUE', style: 'LANDSCAPE', settings: cleanRowSettings('CONTINUE', {}) },
  { title: 'Top 10 This Week', kind: 'MOST_WATCHED', style: 'TOP10', settings: cleanRowSettings('MOST_WATCHED', {}) },
  { title: 'Stories', kind: 'CURATED', style: 'POSTER', settings: cleanRowSettings('CURATED', {}) },
  { title: 'New on MittTV', kind: 'NEW', style: 'LANDSCAPE', settings: cleanRowSettings('NEW', {}) },
];

/**
 * Creates the starting rows once (marked in AppSetting, so rows the admin
 * deletes later are not put back). The banner and Continue Watching are also
 * re-created if they are ever missing, since the screen expects one of each.
 */
export async function ensureSeeded(): Promise<void> {
  if (cache.seeding) return cache.seeding;
  cache.seeding = (async () => {
    const seeded = await prisma.appSetting.findUnique({ where: { key: SEEDED_KEY } });
    if (!seeded) {
      const count = await prisma.mittTvRow.count();
      if (count === 0) {
        await prisma.mittTvRow.createMany({
          data: DEFAULT_ROWS.map((r, i) => ({ ...r, settings: r.settings as object, sortOrder: i })),
        });
      }
      await prisma.appSetting.upsert({
        where: { key: SEEDED_KEY }, update: { value: '1' }, create: { key: SEEDED_KEY, value: '1' },
      });
    }
    for (const kind of ['BANNER', 'CONTINUE'] as const) {
      if (!(await prisma.mittTvRow.findFirst({ where: { kind }, select: { id: true } }))) {
        const def = DEFAULT_ROWS.find((r) => r.kind === kind)!;
        await prisma.mittTvRow.create({ data: { ...def, settings: def.settings as object, sortOrder: kind === 'BANNER' ? -1 : 0 } });
      }
    }
  })().finally(() => { cache.seeding = undefined; });
  return cache.seeding;
}

// ── Picking a row's videos ───────────────────────────────────────────────────

/** Today's date in India, YYYY-MM-DD (what MittTvView.day stores). */
export function istDay(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

/**
 * The most watched active videos: views in the last `days` days first, then
 * all-time views, then the newest — so it is never empty while there are
 * videos. Cached for a few minutes.
 */
export async function mostWatchedIds(days: number, limit: number): Promise<string[]> {
  const key = `${days}|${limit}`;
  const hit = cache.most.get(key);
  if (hit && Date.now() - hit.at < MOST_TTL) return hit.ids;

  const since = istDay(new Date(Date.now() - (days - 1) * 86_400_000));
  const grouped = await prisma.mittTvView.groupBy({
    by: ['videoId'],
    where: { day: { gte: since }, video: { isActive: true } },
    _count: { videoId: true },
    orderBy: { _count: { videoId: 'desc' } },
    take: limit,
  });
  const ids = grouped.map((r) => r.videoId);
  if (ids.length < limit) {
    const more = await prisma.mittTvVideo.findMany({
      where: { isActive: true, id: { notIn: ids } },
      orderBy: [{ viewsCount: 'desc' }, { createdAt: 'desc' }],
      take: limit - ids.length,
      select: { id: true },
    });
    ids.push(...more.map((v) => v.id));
  }
  cache.most.set(key, { at: Date.now(), ids });
  return ids;
}

type RowRecord = { id: string; kind: string; settings: unknown };

async function pickedIds(rowId: string, skip: number, take: number): Promise<string[]> {
  const items = await prisma.mittTvRowItem.findMany({
    where: { rowId, video: { isActive: true } },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    skip, take,
    select: { videoId: true },
  });
  return items.map((i) => i.videoId);
}

/**
 * One page of a row's video ids for this user. Fetches one extra to tell
 * whether there is more. The banner and the most-watched rows are capped at
 * their own limit (no "See all").
 */
export async function rowIds(row: RowRecord, userId: string, offset: number, take: number): Promise<{ ids: string[]; hasMore: boolean }> {
  const s = cleanRowSettings(row.kind, row.settings);

  switch (row.kind) {
    case 'BANNER': {
      const limit = s.limit ?? ROW_DEFAULTS.bannerLimit;
      const pinned = s.mode === 'AUTO' ? [] : await pickedIds(row.id, 0, limit);
      if (s.mode === 'MANUAL' || pinned.length >= limit) return { ids: pinned.slice(0, limit), hasMore: false };
      const auto = (await mostWatchedIds(s.days ?? ROW_DEFAULTS.days, limit + pinned.length)).filter((id) => !pinned.includes(id));
      return { ids: [...pinned, ...auto].slice(0, limit), hasMore: false };
    }
    case 'MOST_WATCHED': {
      const all = await mostWatchedIds(s.days ?? ROW_DEFAULTS.days, s.limit ?? ROW_DEFAULTS.top10Limit);
      return { ids: all.slice(offset, offset + take), hasMore: false };
    }
    case 'CURATED': {
      const ids = await pickedIds(row.id, offset, take + 1);
      return { ids: ids.slice(0, take), hasMore: ids.length > take };
    }
    case 'NEW': {
      const rows = await prisma.mittTvVideo.findMany({
        where: { isActive: true }, orderBy: { createdAt: 'desc' }, skip: offset, take: take + 1, select: { id: true },
      });
      return { ids: rows.slice(0, take).map((r) => r.id), hasMore: rows.length > take };
    }
    case 'CONTINUE': {
      const rows = await prisma.mittTvProgress.findMany({
        where: { userId, finished: false, hidden: false, positionSec: { gte: CONTINUE_MIN_SEC }, video: { isActive: true } },
        orderBy: { updatedAt: 'desc' }, skip: offset, take: take + 1, select: { videoId: true },
      });
      return { ids: rows.slice(0, take).map((r) => r.videoId), hasMore: rows.length > take };
    }
    default:
      return { ids: [], hasMore: false };
  }
}

// ── What the app gets ────────────────────────────────────────────────────────

type VideoRecord = {
  id: string; title: string; description: string; videoUrl: string; thumbnailUrl: string; posterUrl: string;
  durationSec: number; viewsCount: number; createdAt: Date;
};
type FullVideoRecord = VideoRecord & { tags: string; meta: unknown };
type ProgressRecord = { positionSec: number; durationSec: number; finished: boolean };

const VIDEO_SELECT = {
  id: true, title: true, description: true, videoUrl: true, thumbnailUrl: true, posterUrl: true,
  durationSec: true, viewsCount: true, createdAt: true,
} as const;
const FULL_VIDEO_SELECT = { ...VIDEO_SELECT, tags: true, meta: true } as const;

export function toAppVideo(v: VideoRecord, p?: ProgressRecord | null) {
  return {
    id: v.id,
    title: v.title,
    description: v.description,
    videoUrl: v.videoUrl,
    thumbnailUrl: v.thumbnailUrl,
    posterUrl: v.posterUrl,
    durationSec: v.durationSec || p?.durationSec || 0,
    viewsCount: v.viewsCount,
    isNew: Date.now() - v.createdAt.getTime() < NEW_BADGE_DAYS * 86_400_000,
    progress: p && !p.finished ? { positionSec: p.positionSec, durationSec: p.durationSec || v.durationSec } : null,
  };
}
export type AppVideo = ReturnType<typeof toAppVideo>;

const splitTags = (tags: string) => [...new Set(tags.split(',').map((t) => t.trim()).filter(Boolean))].slice(0, 12);

/**
 * A video with everything its details page shows: the card fields, plus its
 * tags, when it was added, and `info` — "label: value" lines. Today they are
 * the admin's extra details; videos from the class & subject platform will
 * add theirs (class, subject…) here too, so the app needs no change for it.
 */
function toFullAppVideo(v: FullVideoRecord, p?: ProgressRecord | null) {
  return {
    ...toAppVideo(v, p),
    tags: splitTags(v.tags),
    addedAt: v.createdAt.toISOString(),
    info: videoDetailsFromMeta(v.meta),
    // The admin's free-text paragraphs, shown above Play.
    notes: videoNotesFromMeta(v.meta),
  };
}

/** The given ids as app videos, in the same order (missing / hidden ones dropped). */
async function videosInOrder(ids: string[], userId: string): Promise<AppVideo[]> {
  if (ids.length === 0) return [];
  const unique = [...new Set(ids)];
  const [videos, progress] = await Promise.all([
    prisma.mittTvVideo.findMany({ where: { id: { in: unique }, isActive: true }, select: VIDEO_SELECT }),
    prisma.mittTvProgress.findMany({
      where: { userId, videoId: { in: unique } },
      select: { videoId: true, positionSec: true, durationSec: true, finished: true },
    }),
  ]);
  const byId = new Map(videos.map((v) => [v.id, v]));
  const progById = new Map(progress.map((p) => [p.videoId, p]));
  return ids.flatMap((id) => {
    const v = byId.get(id);
    return v ? [toAppVideo(v, progById.get(id))] : [];
  });
}

const rowLimit = (row: RowRecord) => {
  const s = cleanRowSettings(row.kind, row.settings);
  if (row.kind === 'BANNER') return s.limit ?? ROW_DEFAULTS.bannerLimit;
  if (row.kind === 'MOST_WATCHED') return s.limit ?? ROW_DEFAULTS.top10Limit;
  return s.limit ?? ROW_DEFAULTS.rowLimit;
};

/** The whole MittTV screen for one user. Rows with no videos are left out. */
export async function buildHome(userId: string, settings: MittTvSettings = DEFAULT_SETTINGS) {
  await ensureSeeded();
  const rows = (await prisma.mittTvRow.findMany({
    where: { isVisible: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  })).filter((r) => isRowKind(r.kind));

  const pages = await Promise.all(rows.map((r) => rowIds(r, userId, 0, rowLimit(r))));
  const videos = await videosInOrder(pages.flatMap((p) => p.ids), userId);
  const byId = new Map(videos.map((v) => [v.id, v]));
  const built = rows.map((r, i) => ({
    id: r.id,
    kind: r.kind,
    title: r.title,
    subtitle: r.subtitle,
    style: r.style,
    seeAllLayout: seeAllLayoutOf(r),
    items: pages[i].ids.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : [])),
    hasMore: pages[i].hasMore,
  })).filter((r) => r.items.length > 0);

  const banner = built.find((r) => r.kind === 'BANNER') ?? null;
  return {
    title: settings.screenTitle,
    search: settings.searchEnabled,
    banner: banner ? { id: banner.id, title: banner.title, items: banner.items } : null,
    rows: built.filter((r) => r.kind !== 'BANNER'),
  };
}

/** How the row's "See all" screen is laid out (AUTO for rows without one). */
function seeAllLayoutOf(row: RowRecord): string {
  if (!(SEE_ALL_KINDS as string[]).includes(row.kind)) return 'AUTO';
  return cleanRowSettings(row.kind, row.settings).seeAllLayout ?? 'AUTO';
}

/** "See all": one page of a visible row. */
export async function rowPage(rowId: string, userId: string, offset: number, limit: number) {
  const row = await prisma.mittTvRow.findFirst({ where: { id: rowId, isVisible: true } });
  if (!row || !isRowKind(row.kind)) return null;
  const { ids, hasMore } = await rowIds(row, userId, offset, limit);
  return {
    row: {
      id: row.id, kind: row.kind, title: row.title, subtitle: row.subtitle, style: row.style,
      seeAllLayout: seeAllLayoutOf(row),
    },
    items: await videosInOrder(ids, userId),
    nextOffset: hasMore ? offset + limit : null,
  };
}

/**
 * Videos like this one, best first, for when it wasn't opened from a row:
 * the other videos of the visible hand-picked rows it is in, then videos
 * sharing one of its tags, then the newest.
 */
async function relatedIds(video: { id: string; tags: string }, max: number): Promise<string[]> {
  const out: string[] = [];
  const add = (ids: string[]) => { for (const x of ids) if (x !== video.id && !out.includes(x)) out.push(x); };

  const rows = await prisma.mittTvRowItem.findMany({
    where: { videoId: video.id, row: { kind: 'CURATED', isVisible: true } },
    select: { rowId: true },
  });
  if (rows.length) {
    const items = await prisma.mittTvRowItem.findMany({
      where: { rowId: { in: rows.map((r) => r.rowId) }, video: { isActive: true } },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      take: max * 2,
      select: { videoId: true },
    });
    add(items.map((i) => i.videoId));
  }
  const tags = splitTags(video.tags).slice(0, 5);
  if (out.length < max && tags.length) {
    const tagged = await prisma.mittTvVideo.findMany({
      where: { isActive: true, id: { not: video.id }, OR: tags.map((t) => ({ tags: { contains: t, mode: 'insensitive' as const } })) },
      orderBy: [{ viewsCount: 'desc' }, { createdAt: 'desc' }],
      take: max,
      select: { id: true },
    });
    add(tagged.map((v) => v.id));
  }
  if (out.length < max) {
    const newest = await prisma.mittTvVideo.findMany({
      where: { isActive: true, id: { not: video.id } }, orderBy: { createdAt: 'desc' }, take: max, select: { id: true },
    });
    add(newest.map((v) => v.id));
  }
  return out.slice(0, max);
}

/**
 * One video for its details page and the player: everything about it, where
 * this user stopped, and what comes next — the videos after it in the row it
 * was opened from (then the start of that row), or videos like it when no
 * row is given. `related.title` names that list on the details page.
 */
export async function videoForPlayer(id: string, userId: string, rowId?: string | null) {
  const [video, progress] = await Promise.all([
    prisma.mittTvVideo.findFirst({ where: { id, isActive: true }, select: FULL_VIDEO_SELECT }),
    prisma.mittTvProgress.findUnique({
      where: { userId_videoId: { userId, videoId: id } },
      select: { positionSec: true, durationSec: true, finished: true },
    }),
  ]);
  if (!video) return null;

  let fromRow: string[] = [];
  const row = rowId ? await prisma.mittTvRow.findFirst({ where: { id: rowId, isVisible: true } }) : null;
  if (row && isRowKind(row.kind)) {
    const order = (await rowIds(row, userId, 0, 50)).ids;
    const at = order.indexOf(id);
    fromRow = (at >= 0 ? [...order.slice(at + 1), ...order.slice(0, at)] : order).filter((x) => x !== id);
  }
  // A row with fewer than 2 other videos is topped up with videos like this one.
  let upNextIds = fromRow;
  const relatedTitle = row && fromRow.length >= 2 ? `More from ${row.title}` : 'More like this';
  if (fromRow.length < 2) upNextIds = [...fromRow, ...(await relatedIds(video, 12)).filter((x) => !fromRow.includes(x))];

  return {
    video: toFullAppVideo(video, progress),
    upNext: await videosInOrder(upNextIds.slice(0, 12), userId),
    related: { title: relatedTitle },
  };
}

// ── Search ───────────────────────────────────────────────────────────────────

const SEARCH_SCAN = 200;

/**
 * Active videos whose title, description or tags contain every word of `q`
 * (any case). Best first: title starts with the search, title contains it,
 * title has every word, the rest — then the most viewed and newest.
 */
export async function searchVideos(userId: string, rawQ: string, offset: number, limit: number) {
  const q = rawQ.trim().replace(/\s+/g, ' ').slice(0, MITTTV_LIMITS.search);
  const words = [...new Set(q.toLowerCase().split(' ').filter(Boolean))].slice(0, 5);
  if (!words.length) return { q, items: [] as AppVideo[], nextOffset: null as number | null, total: 0 };

  const found = await prisma.mittTvVideo.findMany({
    where: {
      isActive: true,
      AND: words.map((w) => ({
        OR: [
          { title: { contains: w, mode: 'insensitive' as const } },
          { description: { contains: w, mode: 'insensitive' as const } },
          { tags: { contains: w, mode: 'insensitive' as const } },
        ],
      })),
    },
    orderBy: [{ viewsCount: 'desc' }, { createdAt: 'desc' }],
    take: SEARCH_SCAN,
    select: { id: true, title: true },
  });
  const ql = q.toLowerCase();
  const rank = (title: string) => {
    const t = title.toLowerCase();
    if (t.startsWith(ql)) return 0;
    if (t.includes(ql)) return 1;
    if (words.every((w) => t.includes(w))) return 2;
    return 3;
  };
  // A stable sort keeps the most viewed / newest order inside each rank.
  const ordered = found.map((v, i) => ({ id: v.id, r: rank(v.title), i })).sort((a, b) => a.r - b.r || a.i - b.i);
  const page = ordered.slice(offset, offset + limit).map((v) => v.id);
  return {
    q,
    items: await videosInOrder(page, userId),
    nextOffset: offset + limit < ordered.length ? offset + limit : null,
    total: ordered.length,
  };
}

/** What the search screen shows before anything is typed. */
export async function searchSuggestions(userId: string) {
  return videosInOrder(await mostWatchedIds(ROW_DEFAULTS.days, 10), userId);
}

// ── Views and progress ───────────────────────────────────────────────────────

/** Counts a play: once per user, video and India-time day. */
export async function recordView(videoId: string, userId: string): Promise<boolean> {
  const video = await prisma.mittTvVideo.findFirst({ where: { id: videoId, isActive: true }, select: { id: true } });
  if (!video) return false;
  // skipDuplicates: a second play the same day is simply not counted.
  const { count } = await prisma.mittTvView.createMany({ data: [{ videoId, userId, day: istDay() }], skipDuplicates: true });
  if (count > 0) await prisma.mittTvVideo.update({ where: { id: videoId }, data: { viewsCount: { increment: 1 } } });
  return true;
}

/**
 * Watched to the end, so out of Continue Watching: the last 8% of the video,
 * or — for videos of 3 minutes and more — the last 15 s (end credits). The
 * 15 s rule must not apply to short clips: a 12 s video would count as
 * finished the moment it starts.
 */
function isFinished(pos: number, dur: number) {
  if (dur <= 0) return false;
  return pos >= dur * 0.92 || (dur >= 180 && dur - pos <= 15);
}

/** From how far into a video it counts as "started" (Continue Watching). */
export const CONTINUE_MIN_SEC = 2;

/** Saves where the user is in a video. Also fills in a length the upload didn't record. */
export async function saveProgress(videoId: string, userId: string, positionSec: number, durationSec: number) {
  const video = await prisma.mittTvVideo.findFirst({ where: { id: videoId, isActive: true }, select: { id: true, durationSec: true } });
  if (!video) return null;
  const dur = Math.max(0, Math.round(durationSec || video.durationSec || 0));
  const pos = Math.max(0, Math.min(Math.round(positionSec), dur || Number.MAX_SAFE_INTEGER));
  const finished = isFinished(pos, dur);
  if (!video.durationSec && dur > 0) {
    await prisma.mittTvVideo.update({ where: { id: videoId }, data: { durationSec: dur } }).catch(() => {});
  }
  return prisma.mittTvProgress.upsert({
    where: { userId_videoId: { userId, videoId } },
    update: { positionSec: pos, durationSec: dur, finished, hidden: false },
    create: { userId, videoId, positionSec: pos, durationSec: dur, finished },
    select: { positionSec: true, durationSec: true, finished: true },
  });
}

/** "Remove from Continue Watching" (comes back if they play it again). */
export async function hideProgress(videoId: string, userId: string) {
  await prisma.mittTvProgress.updateMany({ where: { userId, videoId }, data: { hidden: true } });
}

// ── Media files ──────────────────────────────────────────────────────────────

export const MITTTV_VIDEO_EXTS = ['mp4', 'mov', 'm4v', 'webm'];

export function safeMittTvExt(ext: unknown): string | null {
  const e = typeof ext === 'string' ? ext.toLowerCase().replace(/^\./, '') : '';
  return MITTTV_VIDEO_EXTS.includes(e) ? e : null;
}

const localUrl = (name: string) => `${process.env.SERVER_URL || 'http://localhost:3000'}/uploads/mitttv/${name}`;
const localDir = () => path.join(process.cwd(), 'public', 'uploads', 'mitttv');

/** Where a MittTV file goes: S3 when configured, else public/uploads/mitttv. Returns its URL. */
export async function storeMittTvFile(buffer: Buffer, name: string, contentType: string): Promise<string> {
  if (s3Enabled()) return uploadBufferToS3(buffer, `${MITTTV_MEDIA_PREFIX}${name}`, contentType);
  await mkdir(localDir(), { recursive: true });
  await writeFile(path.join(localDir(), name), buffer);
  return localUrl(name);
}

export { localDir as mittTvLocalDir, localUrl as mittTvLocalUrl };

/**
 * Removes a MittTV file once nothing points at it. Only touches files this
 * feature wrote (uploads/mitttv in S3 or on disk). Best-effort: never fails
 * the admin's request.
 */
export async function deleteMittTvMedia(url: string | null | undefined): Promise<void> {
  if (!url) return;
  try {
    if (s3Enabled()) {
      const key = s3KeyFromUrl(url);
      if (key && key.startsWith(MITTTV_MEDIA_PREFIX)) await deleteFromS3(key);
      return;
    }
    const match = url.match(/\/uploads\/mitttv\/([^/?#]+)$/);
    if (match) await unlink(path.join(localDir(), match[1]));
  } catch (err) {
    console.error(`Could not delete MittTV media ${url}:`, err);
  }
}

/**
 * A thumbnail made on the server with ffmpeg, for when the dashboard couldn't
 * capture one in the browser. Returns its URL, or '' on any failure — a
 * missing thumbnail must never stop the video being saved.
 */
export async function generateMittTvThumbnail(videoUrl: string): Promise<string> {
  const tmpVideo = path.join(os.tmpdir(), `mtv-src-${randomUUID()}`);
  const tmpThumb = path.join(os.tmpdir(), `mtv-thumb-${randomUUID()}.jpg`);
  let source: string | null = null;
  try {
    let baseName: string;
    if (s3Enabled()) {
      const key = s3KeyFromUrl(videoUrl);
      if (!key || !key.startsWith(MITTTV_MEDIA_PREFIX)) return '';
      await downloadFromS3(key, tmpVideo);
      source = tmpVideo;
      baseName = path.basename(key).replace(/\.[^.]+$/, '');
    } else {
      const match = videoUrl.match(/\/uploads\/mitttv\/([^/?#]+)$/);
      if (!match) return '';
      source = path.join(localDir(), match[1]);
      baseName = match[1].replace(/\.[^.]+$/, '');
    }
    await extractThumbnail(source, tmpThumb);
    if ((await stat(tmpThumb)).size === 0) return '';
    return await storeMittTvFile(await readFile(tmpThumb), `${baseName}_thumb.jpg`, 'image/jpeg');
  } catch (err) {
    console.error(`MittTV server thumbnail for ${videoUrl} failed:`, err);
    return '';
  } finally {
    await unlink(tmpThumb).catch(() => {});
    if (source === tmpVideo) await unlink(tmpVideo).catch(() => {});
  }
}
