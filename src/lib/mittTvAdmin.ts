import { prisma } from '@/lib/prisma';
import { getSignedMediaUrl } from '@/lib/s3';
import { clearMittTvCache, ensureSeeded, istDay, loadSettings, rowIds } from '@/lib/mittTv';
import {
  MITTTV_LIMITS, PICKED_KINDS, cleanRowSettings, cleanVideoDetails, cleanVideoNotes, isRowKind, type RowKind,
} from '@/lib/mittTvShared';

// Write side of dashboard → MittTV (read side and the app: lib/mittTv.ts).

const isPicked = (kind: string) => (PICKED_KINDS as string[]).includes(kind);

/** Everything the dashboard page shows, in one go. */
export async function adminSnapshot() {
  await ensureSeeded();
  const since = istDay(new Date(Date.now() - 6 * 86_400_000));
  const [settings, rows, videos, recent] = await Promise.all([
    loadSettings(),
    prisma.mittTvRow.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: { items: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }], select: { videoId: true } } },
    }),
    prisma.mittTvVideo.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.mittTvView.groupBy({ by: ['videoId'], where: { day: { gte: since } }, _count: { videoId: true } }),
  ]);
  const views7d = new Map(recent.map((r) => [r.videoId, r._count.videoId]));

  // What the automatic parts show right now (as any user would see them).
  const autoNow: Record<string, string[]> = {};
  await Promise.all(rows
    .filter((r) => r.kind === 'BANNER' || r.kind === 'MOST_WATCHED' || r.kind === 'NEW')
    .map(async (r) => {
      const s = cleanRowSettings(r.kind, r.settings);
      autoNow[r.id] = (await rowIds(r, '', 0, s.limit ?? 10)).ids;
    }));

  const inRows = new Map<string, string[]>();
  for (const r of rows) for (const it of r.items) inRows.set(it.videoId, [...(inRows.get(it.videoId) ?? []), r.id]);

  return {
    settings,
    rows: rows.map(({ items, ...r }) => ({
      ...r,
      settings: cleanRowSettings(r.kind, r.settings),
      videoIds: items.map((i) => i.videoId),
      autoIds: autoNow[r.id] ?? null,
    })),
    videos: await Promise.all(videos.map(async (v) => ({
      ...v,
      views7d: views7d.get(v.id) ?? 0,
      rowIds: inRows.get(v.id) ?? [],
      previewVideoUrl: await getSignedMediaUrl(v.videoUrl),
      previewThumbnailUrl: await getSignedMediaUrl(v.thumbnailUrl || null),
      previewPosterUrl: await getSignedMediaUrl(v.posterUrl || null),
    }))),
  };
}

export async function signedVideo(id: string) {
  const v = await prisma.mittTvVideo.findUnique({ where: { id } });
  if (!v) return null;
  const items = await prisma.mittTvRowItem.findMany({ where: { videoId: id }, select: { rowId: true } });
  return {
    ...v,
    views7d: 0,
    rowIds: items.map((i) => i.rowId),
    previewVideoUrl: await getSignedMediaUrl(v.videoUrl),
    previewThumbnailUrl: await getSignedMediaUrl(v.thumbnailUrl || null),
    previewPosterUrl: await getSignedMediaUrl(v.posterUrl || null),
  };
}

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/**
 * Cleans a video form. `partial` = only the fields present (PATCH). Returns the
 * data, or an error message. `details` (the extra "label: value" lines) and
 * `notes` (free-text paragraphs) for the app's details page go into
 * meta.details / meta.notes, keeping anything else meta holds (`currentMeta`).
 */
export function cleanVideoInput(body: any, partial: boolean, currentMeta?: unknown): Record<string, any> | string {
  const data: Record<string, any> = {};
  const has = (k: string) => !partial || (body && k in body);
  if (has('title')) {
    const title = str(body?.title, MITTTV_LIMITS.title);
    if (!title) return 'Title is required';
    data.title = title;
  }
  if (has('description')) data.description = str(body?.description, MITTTV_LIMITS.description);
  if (has('tags')) data.tags = str(body?.tags, MITTTV_LIMITS.tags);
  if (has('videoUrl')) {
    const url = str(body?.videoUrl, 2000);
    if (!url) return 'Upload a video first';
    data.videoUrl = url;
  }
  if (has('thumbnailUrl')) data.thumbnailUrl = str(body?.thumbnailUrl, 2000);
  if (has('posterUrl')) data.posterUrl = str(body?.posterUrl, 2000);
  if (has('durationSec')) {
    const d = Math.round(Number(body?.durationSec));
    data.durationSec = Number.isFinite(d) && d > 0 ? d : 0;
  }
  if (body && 'isActive' in body) data.isActive = !!body.isActive;
  const metaPatch: Record<string, unknown> = {};
  if (body && 'details' in body) metaPatch.details = cleanVideoDetails(body.details);
  if (body && 'notes' in body) metaPatch.notes = cleanVideoNotes(body.notes);
  if (Object.keys(metaPatch).length) {
    const meta = currentMeta && typeof currentMeta === 'object' && !Array.isArray(currentMeta) ? currentMeta : {};
    data.meta = { ...meta, ...metaPatch };
  }
  return data;
}

/**
 * Puts a video in exactly these banner / hand-picked rows: added at the end of
 * rows it wasn't in, removed from the others. Ids of other kinds are ignored.
 */
export async function setVideoRows(videoId: string, wanted: unknown): Promise<void> {
  if (!Array.isArray(wanted)) return;
  const rows = await prisma.mittTvRow.findMany({ where: { kind: { in: PICKED_KINDS } }, select: { id: true } });
  const valid = new Set(rows.map((r) => r.id));
  const want = new Set(wanted.filter((id): id is string => typeof id === 'string' && valid.has(id)));
  const current = await prisma.mittTvRowItem.findMany({ where: { videoId }, select: { rowId: true } });
  const have = new Set(current.map((c) => c.rowId));

  const remove = [...have].filter((id) => !want.has(id));
  const add = [...want].filter((id) => !have.has(id));
  if (remove.length) await prisma.mittTvRowItem.deleteMany({ where: { videoId, rowId: { in: remove } } });
  for (const rowId of add) {
    const count = await prisma.mittTvRowItem.count({ where: { rowId } });
    if (count >= MITTTV_LIMITS.rowItems) continue;
    const last = await prisma.mittTvRowItem.findFirst({ where: { rowId }, orderBy: { sortOrder: 'desc' }, select: { sortOrder: true } });
    await prisma.mittTvRowItem.create({ data: { rowId, videoId, sortOrder: (last?.sortOrder ?? -1) + 1 } });
  }
  clearMittTvCache();
}

/** Replaces a banner / hand-picked row's videos with this list, in this order. */
export async function setRowVideos(rowId: string, videoIds: unknown): Promise<string | null> {
  if (!Array.isArray(videoIds)) return 'videoIds must be a list';
  const ids = [...new Set(videoIds.filter((x): x is string => typeof x === 'string'))];
  if (ids.length > MITTTV_LIMITS.rowItems) return `A row can hold at most ${MITTTV_LIMITS.rowItems} videos`;
  const found = await prisma.mittTvVideo.findMany({ where: { id: { in: ids } }, select: { id: true } });
  const ok = new Set(found.map((f) => f.id));
  const list = ids.filter((id) => ok.has(id));
  await prisma.$transaction([
    prisma.mittTvRowItem.deleteMany({ where: { rowId } }),
    prisma.mittTvRowItem.createMany({ data: list.map((videoId, i) => ({ rowId, videoId, sortOrder: i })) }),
  ]);
  clearMittTvCache();
  return null;
}

export function rowKindProblem(kind: unknown): string | null {
  if (!isRowKind(kind)) return 'Unknown row type';
  return null;
}

export function pickedKind(kind: string): kind is RowKind {
  return isPicked(kind);
}
