import { createHash } from 'crypto';
import { MongoClient, ObjectId, type Db } from 'mongodb';
import sharp from 'sharp';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  DEFAULT_ERP_SETTINGS, ERP_CLASSES, ERP_LANGUAGES, cleanErpSettings, erpClassLabel, erpLanguageLabel, isErpClass,
  type ErpSettings,
} from '@/lib/mittTvShared';

// MittTV "Learn by Class": the Mittsure ERP's digital content, read live.
//
// The ERP (c:\Projects\ERP\MittsureERP2026, Express + MongoDB) keeps
//   Series → Book { className, subjectName, bookName, coverImage, status }
//        → Chapter { sortOrder, chapterName, description,
//                    digitalContents[] { language, order, fileName, filePath } }
// and serves the files publicly at <ERP_FILES_URL>/uploads/….
//
// Nothing is copied into Mittmee: the catalog is read from the ERP database
// (read-only queries, cached a few minutes in memory), the app plays the
// videos straight from the ERP server, and covers are shrunk on the fly
// (memory cache only). Mittmee keeps only the SuperAdmin's display choices
// (AppSetting MITTTV_ERP) and, per user, where they stopped in a class video
// (MittTvErpProgress — Continue Watching / Resume; see lib/mittTv.ts). Class
// videos have no view counts (MittTvView needs a MittTvVideo row, a copy), so
// they are not in Most Watched / Top 10.
//
// Env: ERP_MONGODB_URI (a read-only login to the ERP database), optional
// ERP_MONGODB_DB (when the URI has no database name) and ERP_FILES_URL
// (default https://erp2.mittsure.com).

const SETTINGS_KEY = 'MITTTV_ERP';
const SETTINGS_TTL = 30_000;
const CATALOG_TTL = 5 * 60_000;
const BOOK_TTL = 5 * 60_000;
const BOOK_CACHE_MAX = 300;
const COVER_CACHE_MAX = 400;
const UP_NEXT_MAX = 12;
const SEARCH_MAX = 150;

export interface ErpSeries { id: string; name: string }
export interface ErpBook {
  id: string; seriesId: string; seriesName: string; className: string; subject: string; name: string;
  /** Cover path on the ERP server ('' = none). */
  cover: string;
  /** Chapters that have at least one video, and their videos. */
  chapters: number; videos: number;
  languages: string[];
}
export interface ErpCatalog {
  at: number;
  series: ErpSeries[];
  /** Every active book of an active series, in class → series → subject order. */
  books: ErpBook[];
  byId: Map<string, ErpBook>;
  totals: { books: number; chapters: number; videos: number };
}
export interface ErpVideoItem { id: string; language: string; order: number; label: string; fileName: string; filePath: string }
export interface ErpChapter { id: string; no: number; name: string; description: string; videos: ErpVideoItem[] }

type State = {
  client?: Promise<MongoClient>;
  settings?: { at: number; value: ErpSettings };
  catalog?: { at: number; value: ErpCatalog };
  catalogJob?: Promise<ErpCatalog>;
  books: Map<string, { at: number; value: ErpChapter[] }>;
  /** Chapter id → its book id (chapters don't move between books). */
  chapterBook: Map<string, string>;
  covers: Map<string, Buffer>;
  coverJobs: Map<string, Promise<Buffer | null>>;
  rowJob?: Promise<string>;
};
// The dev server gives each route its own copy of this module, so the
// connection and caches live on globalThis (same as lib/mittTv.ts).
const g = globalThis as unknown as { __mittTvErp?: State };
const state: State = (g.__mittTvErp ??= { books: new Map(), chapterBook: new Map(), covers: new Map(), coverJobs: new Map() });
state.chapterBook ??= new Map(); // a dev server that kept the older state object

export class ErpUnavailable extends Error {
  constructor(public code: 'NOT_CONFIGURED' | 'UNREACHABLE', message: string) { super(message); }
}

export const erpConfigured = () => !!process.env.ERP_MONGODB_URI?.trim();
export const erpFilesUrl = () => (process.env.ERP_FILES_URL?.trim() || 'https://erp2.mittsure.com').replace(/\/+$/, '');

/** Full URL of a file the ERP serves (paths there look like /uploads/videos/x.mp4 or uploads/x.png). */
export function erpFileUrl(p: string): string {
  if (/^https?:\/\//i.test(p)) return p;
  return `${erpFilesUrl()}/${encodeURI(p.replace(/\\/g, '/').replace(/^\/+/, ''))}`;
}

async function erpDb(): Promise<Db> {
  const uri = process.env.ERP_MONGODB_URI?.trim();
  if (!uri) throw new ErpUnavailable('NOT_CONFIGURED', 'ERP_MONGODB_URI is not set on the Mittmee server.');
  if (!state.client) {
    const client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 6000, connectTimeoutMS: 6000, maxPoolSize: 5, appName: 'mittmee-mitttv',
    });
    state.client = client.connect().catch((e) => {
      state.client = undefined;
      throw new ErpUnavailable('UNREACHABLE', `Can't reach the ERP database: ${e.message}`);
    });
  }
  return (await state.client).db(process.env.ERP_MONGODB_DB?.trim() || undefined);
}

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const oid = (id: string) => new ObjectId(id);
const isOid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{24}$/i.test(v);

// ── Settings ─────────────────────────────────────────────────────────────────

export async function loadErpSettings(): Promise<ErpSettings> {
  if (state.settings && Date.now() - state.settings.at < SETTINGS_TTL) return state.settings.value;
  const row = await prisma.appSetting.findUnique({ where: { key: SETTINGS_KEY } });
  let value = { ...DEFAULT_ERP_SETTINGS };
  try { if (row?.value) value = cleanErpSettings(JSON.parse(row.value), DEFAULT_ERP_SETTINGS); } catch { /* defaults */ }
  state.settings = { at: Date.now(), value };
  return value;
}

export async function saveErpSettings(patch: unknown): Promise<ErpSettings> {
  const value = cleanErpSettings(patch, await loadErpSettings());
  const json = JSON.stringify(value);
  await prisma.appSetting.upsert({ where: { key: SETTINGS_KEY }, update: { value: json }, create: { key: SETTINGS_KEY, value: json } });
  state.settings = { at: Date.now(), value };
  return value;
}

/** For the app's class routes: null when class content is on, else the answer to send. */
export async function erpOffResponse(): Promise<NextResponse | null> {
  if (erpConfigured() && (await loadErpSettings()).enabled) return null;
  return NextResponse.json({ error: 'Class videos are not available right now', code: 'CLASSES_OFF' }, { status: 404 });
}

/**
 * The MittTV screen's "Learn by Class" row, made once when the SuperAdmin
 * first switches class content on: right after Continue Watching. After that
 * it is moved, renamed or hidden in Screen Rows like any other row.
 */
export async function ensureClassesRow(): Promise<string> {
  if (state.rowJob) return state.rowJob;
  state.rowJob = (async () => {
    const existing = await prisma.mittTvRow.findFirst({ where: { kind: 'CLASSES' }, select: { id: true } });
    if (existing) return existing.id;
    const rows = await prisma.mittTvRow.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }], select: { id: true, kind: true } });
    const created = await prisma.mittTvRow.create({
      data: { kind: 'CLASSES', title: 'Learn by Class', subtitle: 'Videos for every class and subject', style: 'LANDSCAPE', settings: {}, sortOrder: 0 },
    });
    const order = rows.map((r) => r.id);
    const at = rows.findIndex((r) => r.kind === 'CONTINUE');
    order.splice(at >= 0 ? at + 1 : order.length, 0, created.id);
    await prisma.$transaction(order.map((id, i) => prisma.mittTvRow.update({ where: { id }, data: { sortOrder: i } })));
    return created.id;
  })().finally(() => { state.rowJob = undefined; });
  return state.rowJob;
}

// ── Catalog (series, books and how many videos each has) ────────────────────

const LANG_KEYS: string[] = ERP_LANGUAGES.map((l) => l.key);
const langOf = (v: unknown) => str(v).toLowerCase();
const langRank = (l: string) => { const i = LANG_KEYS.indexOf(l); return i < 0 ? LANG_KEYS.length : i; };
const sortLangs = (list: Iterable<string>) => [...new Set(list)].sort((a, b) => langRank(a) - langRank(b) || a.localeCompare(b));

// Core subjects first, the rest A–Z.
const SUBJECT_ORDER = ['english', 'hindi', 'mathematics', 'maths', 'science', 'evs', 'social studies', 'sanskrit'];
const subjectRank = (s: string) => {
  const l = s.toLowerCase();
  const i = SUBJECT_ORDER.findIndex((x) => l === x || l.startsWith(`${x} `));
  return i < 0 ? SUBJECT_ORDER.length : i;
};
const CLASS_KEYS: string[] = ERP_CLASSES.map((c) => c.key);

async function fetchCatalog(): Promise<ErpCatalog> {
  const db = await erpDb();
  const [series, books, counts] = await Promise.all([
    db.collection('series').find({ status: 'Active' }, { projection: { name: 1, createdAt: 1 } }).sort({ createdAt: 1, _id: 1 }).toArray(),
    db.collection('books').find(
      { status: 'Active' },
      { projection: { series: 1, className: 1, subjectName: 1, bookName: 1, coverImage: 1 } },
    ).toArray(),
    // Per book: chapters with at least one video file, the videos, their languages.
    db.collection('chapters').aggregate([
      {
        $project: {
          book: 1,
          items: {
            $filter: {
              input: { $ifNull: ['$digitalContents', []] },
              as: 'd',
              cond: { $gt: [{ $strLenCP: { $ifNull: ['$$d.filePath', ''] } }, 0] },
            },
          },
        },
      },
      { $project: { book: 1, n: { $size: '$items' }, langs: '$items.language' } },
      { $match: { n: { $gt: 0 } } },
      { $group: { _id: '$book', chapters: { $sum: 1 }, videos: { $sum: '$n' }, langs: { $push: '$langs' } } },
    ]).toArray(),
  ]);

  const seriesList: ErpSeries[] = series.map((s) => ({ id: String(s._id), name: str(s.name) || 'Series' }));
  const seriesById = new Map(seriesList.map((s, i) => [s.id, { ...s, i }]));
  const countBy = new Map(counts.map((c) => [String(c._id), c]));

  const out: ErpBook[] = [];
  for (const b of books) {
    const s = seriesById.get(String(b.series));
    if (!s || !isErpClass(b.className)) continue;
    const c = countBy.get(String(b._id));
    const langs = c ? (c.langs as unknown[][]).flat().map(langOf) : [];
    out.push({
      id: String(b._id),
      seriesId: s.id,
      seriesName: s.name,
      className: b.className,
      subject: str(b.subjectName),
      name: str(b.bookName) || str(b.subjectName) || 'Book',
      cover: str(b.coverImage),
      chapters: c?.chapters ?? 0,
      videos: c?.videos ?? 0,
      languages: sortLangs(langs),
    });
  }
  out.sort((a, b) => CLASS_KEYS.indexOf(a.className) - CLASS_KEYS.indexOf(b.className)
    || seriesById.get(a.seriesId)!.i - seriesById.get(b.seriesId)!.i
    || subjectRank(a.subject) - subjectRank(b.subject)
    || a.subject.localeCompare(b.subject) || a.name.localeCompare(b.name));

  const withVideos = out.filter((b) => b.videos > 0);
  return {
    at: Date.now(),
    series: seriesList,
    books: out,
    byId: new Map(out.map((b) => [b.id, b])),
    totals: {
      books: withVideos.length,
      chapters: withVideos.reduce((n, b) => n + b.chapters, 0),
      videos: withVideos.reduce((n, b) => n + b.videos, 0),
    },
  };
}

function refreshCatalog(): Promise<ErpCatalog> {
  if (!state.catalogJob) {
    state.catalogJob = fetchCatalog()
      .then((value) => { state.catalog = { at: Date.now(), value }; return value; })
      .finally(() => { state.catalogJob = undefined; });
  }
  return state.catalogJob;
}

/**
 * The ERP's catalog. After the first load it answers from memory at once and
 * refreshes in the background every few minutes; if the ERP is down, the last
 * catalog keeps being used. `force` waits for a fresh read (dashboard "Refresh").
 */
export async function erpCatalog(force = false): Promise<ErpCatalog> {
  const hit = state.catalog;
  if (force) {
    state.books.clear();
    return refreshCatalog();
  }
  if (hit) {
    if (Date.now() - hit.at >= CATALOG_TTL) refreshCatalog().catch((e) => console.error('MittTV ERP catalog refresh failed:', e.message));
    return hit.value;
  }
  return refreshCatalog();
}

function isVisible(b: ErpBook, s: ErpSettings) {
  return b.videos > 0 && !s.hiddenBooks.includes(b.id) && !s.hiddenSeries.includes(b.seriesId) && !s.hiddenClasses.includes(b.className);
}

// ── Chapters of a book ───────────────────────────────────────────────────────

/** A video's id in MittTV: erp-<chapter id>-<hash of its file path>. */
const ERP_VIDEO_ID = /^erp-([0-9a-f]{24})-([0-9a-f]{12})$/i;
export const isErpVideoId = (id: string) => ERP_VIDEO_ID.test(id);
const videoIdFor = (chapterId: string, filePath: string) => `erp-${chapterId}-${createHash('sha1').update(filePath).digest('hex').slice(0, 12)}`;

/** "Chapter 5 (Part 1)" → "Part 1", "Exercise" → "Exercise", "Chapter 3" → "Part <n>". */
function partLabel(fileName: string, index: number) {
  const t = fileName
    .replace(/^\s*(chapter|ch\.?|lesson|unit|पाठ)\s*[-–:.]?\s*\d+\s*[-–:.]?\s*/i, '')
    .replace(/[()[\]]/g, ' ').replace(/\s+/g, ' ').trim();
  return t || `Part ${index + 1}`;
}

/** The chapter's own description, unless it only repeats the chapter name. */
function meaningful(description: string, name: string) {
  const d = description.trim();
  if (!d) return '';
  const dl = d.toLowerCase();
  const nl = name.toLowerCase();
  return dl === nl || nl.includes(dl) ? '' : d;
}

/**
 * The chapter name without the number it often starts with ("1. Large
 * Numbers", "Chapter 1 - Number and Numeration", "पाठ-1 नन्हे बच्चे", "अध्याय 1 -
 * वर्णमाला"): the app shows the chapter's number itself. A bare number needs a
 * mark after it ("1." / "1)"), so "1000 and Beyond" is kept whole.
 */
function cleanChapterName(raw: string): string {
  const t = raw.replace(/^\s*(?:(?:chapter|ch\.?|lesson|unit|पाठ|अध्याय)\s*[-–:.]?\s*\d+\s*[-–:.)]?|\d+\s*[.):–-])\s*/i, '').trim();
  return t || raw;
}

function toChapter(doc: any): ErpChapter {
  const id = String(doc._id);
  const name = cleanChapterName(str(doc.chapterName)) || `Chapter ${doc.sortOrder ?? ''}`.trim();
  const raw: any[] = Array.isArray(doc.digitalContents) ? doc.digitalContents : [];
  const items = raw
    .map((d, i) => ({ d, i }))
    .filter(({ d }) => d && str(d.filePath))
    .map(({ d, i }) => ({
      language: langOf(d.language),
      order: Number.isFinite(Number(d.order)) ? Number(d.order) : i + 1,
      fileName: str(d.fileName),
      filePath: str(d.filePath),
      i,
    }))
    // By language (Bilingual, English, …), then the ERP's own order.
    .sort((a, b) => langRank(a.language) - langRank(b.language) || a.language.localeCompare(b.language) || a.order - b.order || a.i - b.i);

  const byLang = new Map<string, typeof items>();
  for (const it of items) byLang.set(it.language, [...(byLang.get(it.language) ?? []), it]);
  const videos: ErpVideoItem[] = [];
  for (const group of byLang.values()) {
    const seen = new Map<string, number>();
    group.forEach((it, idx) => {
      let label = group.length > 1 ? partLabel(it.fileName, idx) : '';
      if (label) {
        const n = (seen.get(label) ?? 0) + 1;
        seen.set(label, n);
        if (n > 1) label = `${label} ${n}`;
      }
      videos.push({ id: videoIdFor(id, it.filePath), language: it.language, order: it.order, label, fileName: it.fileName, filePath: it.filePath });
    });
  }
  return { id, no: Number(doc.sortOrder) || 0, name, description: meaningful(str(doc.description), name), videos };
}

async function fetchChapters(bookId: string): Promise<ErpChapter[]> {
  const db = await erpDb();
  const docs = await db.collection('chapters').find(
    { book: { $in: [oid(bookId), bookId] } },
    { projection: { chapterName: 1, description: 1, sortOrder: 1, digitalContents: 1 } },
  ).sort({ sortOrder: 1, _id: 1 }).toArray();
  for (const d of docs) state.chapterBook.set(String(d._id), bookId);
  return docs.map(toChapter);
}

/** The book ids of these chapters (from memory, else one ERP query). */
async function booksOfChapters(chapterIds: string[]): Promise<Map<string, string>> {
  const unknown = chapterIds.filter((c) => !state.chapterBook.has(c));
  if (unknown.length) {
    const db = await erpDb();
    const docs = await db.collection('chapters').find({ _id: { $in: unknown.map(oid) } }, { projection: { book: 1 } }).toArray();
    for (const d of docs) state.chapterBook.set(String(d._id), String(d.book));
  }
  return new Map(chapterIds.flatMap((c) => (state.chapterBook.has(c) ? [[c, state.chapterBook.get(c)!] as [string, string]] : [])));
}

/** All chapters of a book (also ones without videos), cached a few minutes. */
async function bookChapters(bookId: string): Promise<ErpChapter[]> {
  const hit = state.books.get(bookId);
  if (hit && Date.now() - hit.at < BOOK_TTL) return hit.value;
  try {
    const value = await fetchChapters(bookId);
    state.books.delete(bookId);
    state.books.set(bookId, { at: Date.now(), value });
    while (state.books.size > BOOK_CACHE_MAX) state.books.delete(state.books.keys().next().value!);
    return value;
  } catch (e) {
    if (hit) return hit.value; // ERP down: the last copy in memory
    throw e;
  }
}

// ── What the app gets ────────────────────────────────────────────────────────

/**
 * Relative: the app puts its own server address in front (api/mittTvAPI.js →
 * reachable). Raise COVER_VERSION when the pictures change, so phones (which
 * keep them a day) and this server's memory make the new ones.
 */
const COVER_VERSION = 2;
const coverPath = (bookId: string, shape: 'wide' | 'tall') => `/api/app/mitttv/erp/cover/${bookId}?shape=${shape}&v=${COVER_VERSION}`;

function bookCard(b: ErpBook) {
  return {
    id: b.id,
    name: b.name,
    subject: b.subject,
    seriesId: b.seriesId,
    seriesName: b.seriesName,
    className: b.className,
    classLabel: erpClassLabel(b.className),
    posterUrl: b.cover ? coverPath(b.id, 'tall') : '',
    thumbnailUrl: b.cover ? coverPath(b.id, 'wide') : '',
    chapters: b.chapters,
    videos: b.videos,
  };
}

const videoTitle = (ch: ErpChapter, v: ErpVideoItem) => (v.label ? `${ch.name} · ${v.label}` : ch.name);

/** A class video in the same shape as an uploaded one (cards, search, up next). */
function cardVideo(b: ErpBook, ch: ErpChapter, v: ErpVideoItem) {
  return {
    id: v.id,
    title: videoTitle(ch, v),
    description: [erpClassLabel(b.className), b.subject, b.name].filter(Boolean).join(' · '),
    videoUrl: erpFileUrl(v.filePath),
    thumbnailUrl: b.cover ? coverPath(b.id, 'wide') : '',
    posterUrl: b.cover ? coverPath(b.id, 'tall') : '',
    durationSec: 0,
    viewsCount: 0,
    isNew: false,
    /** Where this user stopped — filled in from MittTvErpProgress by lib/mittTv.ts. */
    progress: null as { positionSec: number; durationSec: number } | null,
    source: 'ERP' as const,
    /** Drawn on the picture: every video of a book shares its cover. */
    badge: ch.no ? `Ch ${ch.no}` : '',
    bookId: b.id,
  };
}
export type ErpAppVideo = ReturnType<typeof cardVideo>;

/** The "Learn by Class" row: classes that have videos to show, in school order. */
export async function erpClassTiles() {
  const [cat, settings] = await Promise.all([erpCatalog(), loadErpSettings()]);
  const visible = cat.books.filter((b) => isVisible(b, settings));
  return ERP_CLASSES.flatMap((c) => {
    const books = visible.filter((b) => b.className === c.key);
    if (!books.length) return [];
    return [{ key: c.key, label: c.label, group: c.group, books: books.length, videos: books.reduce((n, b) => n + b.videos, 0) }];
  });
}

/** One class: its series (in the ERP's order), each with its books. */
export async function erpClassPage(key: string) {
  if (!isErpClass(key)) return null;
  const [cat, settings] = await Promise.all([erpCatalog(), loadErpSettings()]);
  if (settings.hiddenClasses.includes(key)) return null;
  const books = cat.books.filter((b) => b.className === key && isVisible(b, settings));
  const series = cat.series
    .map((s) => ({ id: s.id, name: s.name, books: books.filter((b) => b.seriesId === s.id).map(bookCard) }))
    .filter((s) => s.books.length > 0);
  return {
    class: { key, label: erpClassLabel(key) },
    totals: { books: books.length, videos: books.reduce((n, b) => n + b.videos, 0) },
    series,
  };
}

/** One book: its chapters in order, each with its videos (grouped by language). */
export async function erpBookPage(bookId: string) {
  if (!isOid(bookId)) return null;
  const [cat, settings] = await Promise.all([erpCatalog(), loadErpSettings()]);
  const book = cat.byId.get(bookId);
  if (!book || !isVisible(book, settings)) return null;
  const chapters = (await bookChapters(bookId)).filter((c) => c.videos.length > 0);
  return {
    book: bookCard(book),
    languages: sortLangs(chapters.flatMap((c) => c.videos.map((v) => v.language))).map((l) => ({ key: l, label: erpLanguageLabel(l) })),
    chapters: chapters.map((c) => ({
      id: c.id,
      no: c.no,
      name: c.name,
      description: c.description,
      videos: c.videos.map((v) => ({
        id: v.id, language: v.language, label: v.label, title: videoTitle(c, v), videoUrl: erpFileUrl(v.filePath),
      })),
    })),
  };
}

/**
 * A class video for its details page and the player, in the same shape as
 * videoForPlayer() in lib/mittTv.ts: the video with its class, subject, book
 * and chapter as `info` lines, `choices` (its other languages and parts), and
 * what plays next — the rest of the book in the same language.
 */
export async function erpVideoForPlayer(id: string) {
  const m = ERP_VIDEO_ID.exec(id);
  if (!m || !erpConfigured()) return null;
  const [cat, settings] = await Promise.all([erpCatalog(), loadErpSettings()]);
  if (!settings.enabled) return null;
  const bookId = (await booksOfChapters([m[1]])).get(m[1]);
  const book = bookId ? cat.byId.get(bookId) : undefined;
  if (!book || !isVisible(book, settings)) return null;

  const chapters = (await bookChapters(book.id)).filter((c) => c.videos.length > 0);
  const ci = chapters.findIndex((c) => c.id === m[1]);
  const ch = chapters[ci];
  const v = ch?.videos.find((x) => x.id === id);
  if (!ch || !v) return null;

  const sameLang = ch.videos.filter((x) => x.language === v.language);
  const part = sameLang.indexOf(v);
  const langs = sortLangs(ch.videos.map((x) => x.language));

  const choices: { key: string; label: string; options: { id: string; label: string; current: boolean }[] }[] = [];
  if (langs.length > 1) {
    choices.push({
      key: 'language',
      label: 'Language',
      options: langs.map((l) => {
        const group = ch.videos.filter((x) => x.language === l);
        const pick = group[Math.min(part, group.length - 1)];
        return { id: pick.id, label: erpLanguageLabel(l), current: l === v.language };
      }),
    });
  }
  if (sameLang.length > 1) {
    choices.push({ key: 'part', label: 'Part', options: sameLang.map((x) => ({ id: x.id, label: x.label, current: x.id === v.id })) });
  }

  // The rest of this chapter, then the next chapters (round to the start), in
  // this language when a chapter has it.
  const upNext: ErpAppVideo[] = sameLang.slice(part + 1).map((x) => cardVideo(book, ch, x));
  for (let k = 1; k < chapters.length && upNext.length < UP_NEXT_MAX; k++) {
    const c = chapters[(ci + k) % chapters.length];
    const inLang = c.videos.filter((x) => x.language === v.language);
    const list = inLang.length ? inLang : c.videos.filter((x) => x.language === c.videos[0].language);
    for (const x of list) {
      if (upNext.length >= UP_NEXT_MAX) break;
      upNext.push(cardVideo(book, c, x));
    }
  }

  const info = [
    { label: 'Class', value: erpClassLabel(book.className) },
    { label: 'Subject', value: book.subject },
    { label: 'Book', value: book.name },
    { label: 'Series', value: book.seriesName },
    { label: 'Chapter', value: `${ci + 1} of ${chapters.length}` },
    { label: 'Language', value: erpLanguageLabel(v.language) },
    ...(sameLang.length > 1 ? [{ label: 'Part', value: `${part + 1} of ${sameLang.length}` }] : []),
  ].filter((d) => d.value);

  // What the app's class-video details page draws: the book line, "Chapter 1
  // of 13 • Part 2 • Bilingual", and the book's chapter list (each opening its
  // first video in this language).
  const erp = {
    bookId: book.id,
    bookName: book.name,
    subject: book.subject,
    seriesName: book.seriesName,
    classLabel: erpClassLabel(book.className),
    chapterName: ch.name,
    chapterNo: ci + 1,
    chapterCount: chapters.length,
    part: sameLang.length > 1 ? { no: part + 1, count: sameLang.length, label: v.label } : null,
    language: erpLanguageLabel(v.language),
    chapters: chapters.map((c, i) => {
      const inLang = c.videos.filter((x) => x.language === v.language);
      const list = inLang.length ? inLang : c.videos.filter((x) => x.language === c.videos[0].language);
      return { no: i + 1, name: c.name, videoId: list[0].id, parts: list.length, current: c.id === ch.id };
    }),
  };

  return {
    video: {
      ...cardVideo(book, ch, v), description: ch.description, tags: [] as string[], addedAt: null, info, notes: [] as string[], choices, erp,
    },
    upNext,
    related: { title: `More from ${book.name}` },
  };
}

/**
 * Class videos by id as cards (Continue Watching), built live from the ERP.
 * Ids whose video is gone, hidden by the SuperAdmin, or while class content is
 * off are left out.
 */
export async function erpCardsByIds(ids: string[]): Promise<Map<string, ErpAppVideo>> {
  const out = new Map<string, ErpAppVideo>();
  const wanted = new Set(ids.filter(isErpVideoId));
  if (!wanted.size || !erpConfigured()) return out;
  const [cat, settings] = await Promise.all([erpCatalog(), loadErpSettings()]);
  if (!settings.enabled) return out;
  const chapterIds = [...new Set([...wanted].map((id) => ERP_VIDEO_ID.exec(id)![1].toLowerCase()))];
  const bookIds = new Set((await booksOfChapters(chapterIds)).values());
  for (const bookId of bookIds) {
    const book = cat.byId.get(bookId);
    if (!book || !isVisible(book, settings)) continue;
    for (const ch of await bookChapters(bookId)) {
      for (const v of ch.videos) if (wanted.has(v.id)) out.set(v.id, cardVideo(book, ch, v));
    }
  }
  return out;
}

// ── Search ───────────────────────────────────────────────────────────────────

const escapeRegex = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Class videos for MittTV search: chapters where every word is in the chapter
 * name or in its book's name / subject / series / class. One result per
 * chapter (its first video). Empty when class content is off or the ERP can't
 * be reached — search must keep working for uploaded videos.
 */
export async function searchErp(words: string[]): Promise<{ title: string; video: ErpAppVideo }[]> {
  if (!words.length || !erpConfigured()) return [];
  const settings = await loadErpSettings();
  if (!settings.enabled) return [];
  const cat = await erpCatalog();
  const visible = cat.books.filter((b) => isVisible(b, settings));
  if (!visible.length) return [];
  const byId = new Map(visible.map((b) => [b.id, b]));
  const bookText = new Map(visible.map((b) => [b.id, `${b.name} ${b.subject} ${b.seriesName} ${erpClassLabel(b.className)}`.toLowerCase()]));
  const booksWith = (w: string) => visible.filter((b) => bookText.get(b.id)!.includes(w)).map((b) => oid(b.id));

  const db = await erpDb();
  const docs = await db.collection('chapters').find(
    {
      book: { $in: visible.map((b) => oid(b.id)) },
      'digitalContents.0': { $exists: true },
      $and: words.map((w) => ({ $or: [{ chapterName: { $regex: escapeRegex(w), $options: 'i' } }, { book: { $in: booksWith(w) } }] })),
    },
    { projection: { book: 1, chapterName: 1, description: 1, sortOrder: 1, digitalContents: 1 } },
  ).limit(SEARCH_MAX).toArray();

  return docs.flatMap((d) => {
    const book = byId.get(String(d.book));
    const ch = toChapter(d);
    const first = ch.videos[0];
    return book && first ? [{ title: ch.name, video: cardVideo(book, ch, first) }] : [];
  });
}

// ── Covers ───────────────────────────────────────────────────────────────────

/**
 * A book's cover, made small for the app: 'tall' = a 360×500 poster, 'wide' =
 * a 640×360 picture filling the card (the top of the cover, with the book's
 * title) for cards and the details page. The ERP's covers are full-size PNGs
 * of several MB. Kept in memory only.
 */
export async function erpCover(bookId: string, shape: 'wide' | 'tall'): Promise<Buffer | null> {
  if (!isOid(bookId)) return null;
  const key = `${bookId}:${shape}:v${COVER_VERSION}`;
  const hit = state.covers.get(key);
  if (hit) {
    state.covers.delete(key);
    state.covers.set(key, hit);
    return hit;
  }
  let job = state.coverJobs.get(key);
  if (!job) {
    job = makeCover(bookId, shape)
      .then((buf) => {
        if (buf) {
          state.covers.set(key, buf);
          while (state.covers.size > COVER_CACHE_MAX) state.covers.delete(state.covers.keys().next().value!);
        }
        return buf;
      })
      .finally(() => state.coverJobs.delete(key));
    state.coverJobs.set(key, job);
  }
  return job;
}

async function makeCover(bookId: string, shape: 'wide' | 'tall'): Promise<Buffer | null> {
  const book = (await erpCatalog()).byId.get(bookId);
  if (!book?.cover) return null;
  const res = await fetch(erpFileUrl(book.cover), { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) return null;
  const src = await sharp(Buffer.from(await res.arrayBuffer())).rotate().flatten({ background: '#1A1A24' }).toBuffer();
  if (shape === 'tall') {
    return sharp(src).resize(360, 500, { fit: 'cover', position: 'top' }).jpeg({ quality: 80, mozjpeg: true }).toBuffer();
  }
  // Fills the whole wide card: the top of the cover, where the book's title is.
  return sharp(src).resize(640, 360, { fit: 'cover', position: 'top' }).jpeg({ quality: 80, mozjpeg: true }).toBuffer();
}

// ── Dashboard ────────────────────────────────────────────────────────────────

/** Connection status, the totals and what each class / series has, for the Class Content tab. */
export async function erpAdminOverview(refresh = false) {
  const settings = await loadErpSettings();
  // The "Learn by Class" row on the MittTV screen (made when first switched on).
  const row = await prisma.mittTvRow.findFirst({ where: { kind: 'CLASSES' }, select: { id: true, title: true, isVisible: true } });
  const base = { configured: erpConfigured(), filesUrl: erpFilesUrl(), settings, row };
  if (!base.configured) {
    return {
      ...base,
      status: { ok: false, code: 'NOT_CONFIGURED', error: 'ERP_MONGODB_URI is not set on the Mittmee server.', checkedAt: null },
      totals: null, classes: [], series: [],
    };
  }
  try {
    const cat = await erpCatalog(refresh);
    const withVideos = cat.books.filter((b) => b.videos > 0);
    return {
      ...base,
      status: { ok: true, code: null, error: null, checkedAt: new Date(cat.at).toISOString() },
      totals: cat.totals,
      classes: ERP_CLASSES.map((c) => {
        const books = withVideos.filter((b) => b.className === c.key);
        return { key: c.key, label: c.label, books: books.length, videos: books.reduce((n, b) => n + b.videos, 0) };
      }),
      series: cat.series.map((s) => {
        const books = withVideos.filter((b) => b.seriesId === s.id);
        return {
          id: s.id, name: s.name, books: books.length, videos: books.reduce((n, b) => n + b.videos, 0),
          classes: ERP_CLASSES.filter((c) => books.some((b) => b.className === c.key)).map((c) => c.key),
        };
      }),
    };
  } catch (e: any) {
    return {
      ...base,
      status: { ok: false, code: e instanceof ErpUnavailable ? e.code : 'UNREACHABLE', error: e.message || 'Could not read the ERP', checkedAt: null },
      totals: null, classes: [], series: [],
    };
  }
}

/** Every active book of a class (optionally one series), with or without videos. */
export async function erpAdminBooks(classKey: string, seriesId?: string | null) {
  if (!isErpClass(classKey)) return [];
  const cat = await erpCatalog();
  return cat.books
    .filter((b) => b.className === classKey && (!seriesId || b.seriesId === seriesId))
    .map((b) => ({ ...bookCard(b), languages: b.languages.map(erpLanguageLabel) }));
}

/** One book with all its chapters and video links, for the dashboard preview. */
export async function erpAdminBook(bookId: string) {
  if (!isOid(bookId)) return null;
  const book = (await erpCatalog()).byId.get(bookId);
  if (!book) return null;
  const chapters = await bookChapters(bookId);
  return {
    book: { ...bookCard(book), languages: book.languages.map(erpLanguageLabel) },
    chapters: chapters.map((c) => ({
      id: c.id,
      no: c.no,
      name: c.name,
      description: c.description,
      videos: c.videos.map((v) => ({
        id: v.id, language: erpLanguageLabel(v.language), label: v.label, fileName: v.fileName, url: erpFileUrl(v.filePath),
      })),
    })),
  };
}
