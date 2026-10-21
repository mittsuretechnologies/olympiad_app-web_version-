#!/usr/bin/env node
// Background job: gives every approved reel an adaptive-quality (HLS) copy, so
// the app can start a reel in low quality straight away and sharpen it as the
// network allows (the way Instagram / YouTube play), instead of waiting for
// the single MP4 to download fast enough.
//
//   node scripts/hls-worker.mjs                    dry run: lists what would be converted
//   node scripts/hls-worker.mjs --once             convert the backlog (one at a time), then exit
//   node scripts/hls-worker.mjs --once --limit 3 --only id1,id2
//   node scripts/hls-worker.mjs --watch            keep running: convert newly approved reels
//                                                  (this is what pm2 runs, see bottom of file)
//   node scripts/hls-worker.mjs --clear [--only id1,id2]
//                                                  undo: app goes back to the MP4 (files stay in S3)
//   node scripts/hls-worker.mjs --test-encode in.mp4 outDir
//                                                  encode one local file only — no database, no S3
//
// Run from the app folder (it reads ./.env), at low priority:
//   nice -n 19 node scripts/hls-worker.mjs --once
//
// Per reel:
//   1. downloads the published MP4 (videoUrl — the original is never touched)
//   2. encodes 360p / 540p / 720p renditions (never above the source), 4-second
//      pieces, plus a master.m3u8 that lists them
//   3. verifies the result (every rendition present, same length)
//   4. uploads the folder next to the MP4 as <name>_hls/ — inside the uploader's
//      own folder, so account deletion removes it with everything else
//   5. checks master.m3u8 is reachable, then sets Video.hlsUrl
// videoUrl is never changed: the dashboard, downloads, share pages and older
// app builds keep using the MP4. Only app builds with HLS support read hlsUrl.

import { readFileSync, existsSync, mkdirSync, createWriteStream, appendFileSync, writeFileSync, readdirSync, statSync, rmSync, createReadStream } from 'node:fs';
import { spawn } from 'node:child_process';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';

// ── settings ──────────────────────────────────────────────────────────────────
// Renditions by SHORT edge (width of a portrait reel). One above the source is
// never made; the smallest is always made.
const LADDER = [
  { short: 360, kbps: 600,  max: 750 },
  { short: 540, kbps: 1200, max: 1500 },
  { short: 720, kbps: 2200, max: 2600 },
];
const SEGMENT_SECONDS = 4;
const ENCODE_TIMEOUT_MS = 20 * 60 * 1000; // generous: low priority, one at a time
const WATCH_POLL_MS = 60_000;
const UPLOAD_CONCURRENCY = 6;

// ── args ──────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const flag = (n) => argv.includes(`--${n}`);
const opt = (n) => {
  const i = argv.indexOf(`--${n}`);
  if (i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--')) return argv[i + 1];
  const eq = argv.find((a) => a.startsWith(`--${n}=`));
  return eq ? eq.split('=').slice(1).join('=') : null;
};
const ONCE = flag('once');
const WATCH = flag('watch');
const CLEAR = flag('clear');
const LIMIT = opt('limit') ? parseInt(opt('limit'), 10) : Infinity;
const ONLY = opt('only') ? new Set(opt('only').split(',')) : null;
const RETRY_FAILED = flag('retry-failed');
const TEST_ENCODE = flag('test-encode');

// ── env ───────────────────────────────────────────────────────────────────────
function loadEnv(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m || line.trim().startsWith('#')) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!(m[1] in process.env)) process.env[m[1]] = v;
  }
}
loadEnv(path.join(process.cwd(), '.env'));

const ffmpegPath = (await import('ffmpeg-static')).default;
const ffprobePath = (await import('ffprobe-static')).default.path;

const BUCKET = process.env.S3_BUCKET;
const REGION = process.env.S3_REGION || 'ap-south-1';
const HAVE_S3 = Boolean(BUCKET && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY);
const PUBLIC_BASES = [
  process.env.S3_PUBLIC_URL,
  BUCKET && `https://${BUCKET}.s3.${REGION}.amazonaws.com`,
  BUCKET && `https://${BUCKET}.s3.amazonaws.com`,
].filter(Boolean).map((b) => b.replace(/\/$/, ''));

// Reels that failed once are not retried by --watch (a broken file would
// otherwise be re-encoded every minute). --retry-failed clears the list.
const FAILED_FILE = path.join(process.cwd(), 'hls-failed.json');
const LOG_FILE = path.join(process.cwd(), 'hls-log.jsonl');

let s3 = null;
async function getS3() {
  if (!s3) {
    const { S3Client } = await import('@aws-sdk/client-s3');
    s3 = new S3Client({ region: REGION, credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY } });
  }
  return s3;
}

// ── helpers ───────────────────────────────────────────────────────────────────
const mb = (b) => (b / 1048576).toFixed(1);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stamp = () => new Date().toISOString().replace('T', ' ').slice(0, 19);
const log = (...a) => console.log(`[${stamp()}]`, ...a);

function run(bin, args, { timeoutMs = 60_000, capture = false } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(bin, args);
    let out = '', err = '';
    p.stdout.on('data', (d) => { if (capture) out += d; });
    p.stderr.on('data', (d) => { err = (err + d).slice(-3000); });
    const t = setTimeout(() => { p.kill('SIGKILL'); reject(new Error('timed out')); }, timeoutMs);
    p.on('error', (e) => { clearTimeout(t); reject(e); });
    p.on('close', (c) => { clearTimeout(t); c === 0 ? resolve(out) : reject(new Error(`exit ${c}: ${err}`)); });
  });
}

async function probe(file) {
  const out = await run(ffprobePath, ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file], { capture: true });
  const j = JSON.parse(out);
  const v = (j.streams || []).find((s) => s.codec_type === 'video');
  if (!v) throw new Error('no video stream');
  // A phone video stored sideways with a rotation flag displays the other way round.
  const rot = Math.abs(parseInt(v.tags?.rotate ?? v.side_data_list?.find((d) => d.rotation !== undefined)?.rotation ?? 0, 10)) % 180;
  return {
    duration: parseFloat(j.format?.duration) || 0,
    width: rot === 90 ? v.height || 0 : v.width || 0,
    height: rot === 90 ? v.width || 0 : v.height || 0,
    hasAudio: (j.streams || []).some((s) => s.codec_type === 'audio'),
  };
}

const even = (n) => Math.max(2, Math.round(n / 2) * 2);

/** The renditions to make for a source of this size, smallest first. */
function ladderFor(width, height) {
  const short = Math.min(width, height), long = Math.max(width, height);
  const rungs = LADDER.filter((r) => r.short <= short + 8);
  if (!rungs.length) rungs.push({ ...LADDER[0], short: even(short) });
  // A source between two rungs (e.g. 480p) also gets a top rendition at its
  // own size, so its best quality is never lower than what it was uploaded at.
  const top = rungs[rungs.length - 1];
  const next = LADDER.find((r) => r.short > top.short);
  if (next && short >= top.short * 1.15) {
    const f = (short - top.short) / (next.short - top.short);
    rungs.push({ short: even(short), kbps: Math.round(top.kbps + f * (next.kbps - top.kbps)), max: Math.round(top.max + f * (next.max - top.max)) });
  }
  return rungs.map((r) => {
    const s = Math.min(r.short, even(short));
    const l = even((long * s) / short);
    return { ...r, w: width <= height ? s : l, h: width <= height ? l : s };
  });
}

function locateKey(url) {
  for (const base of PUBLIC_BASES) {
    if (url.startsWith(base + '/')) return { base, key: decodeURIComponent(url.slice(base.length + 1).split('?')[0]) };
  }
  if (/^https?:\/\//.test(url)) {
    // e.g. a CloudFront domain other than S3_PUBLIC_URL: still an S3 object, key = path.
    const u = new URL(url);
    const key = decodeURIComponent(u.pathname.replace(/^\//, ''));
    if (key.startsWith('uploads/')) return { base: u.origin, key };
  }
  return null;
}

async function download(url, dest) {
  const r = await fetch(url);
  if (!r.ok || !r.body) throw new Error(`download ${r.status}`);
  await pipeline(Readable.fromWeb(r.body), createWriteStream(dest));
}

// ── encoding ──────────────────────────────────────────────────────────────────
async function encodeHls(input, outDir) {
  const meta = await probe(input);
  if (!meta.duration) throw new Error('could not read the length');
  const rungs = ladderFor(meta.width, meta.height);
  try {
    await encodeOnce(input, outDir, rungs, meta.hasAudio);
  } catch (e) {
    // Some phones write a colour-range tag ffmpeg refuses ("Invalid color range").
    // Rewrite just that tag (lossless copy) and encode from the copy. Same as videoOptimize.ts.
    if (!String(e.message).includes('Invalid color range')) throw e;
    const fixed = path.join(path.dirname(outDir), `range-fixed-${randomUUID()}.mp4`);
    try {
      await run(ffmpegPath, ['-i', input, '-bsf:v', 'h264_metadata=video_full_range_flag=0:colour_primaries=1:transfer_characteristics=1:matrix_coefficients=1', '-c', 'copy', '-y', fixed], { timeoutMs: 10 * 60 * 1000 });
      rmSync(outDir, { recursive: true, force: true });
      mkdirSync(outDir, { recursive: true });
      await encodeOnce(fixed, outDir, rungs, meta.hasAudio);
    } finally { rmSync(fixed, { force: true }); }
  }
  await verify(outDir, rungs, meta);
  return { meta, rungs };
}

async function encodeOnce(input, outDirNative, rungs, hasAudio) {
  // Forward slashes: ffmpeg copies these paths into the playlists.
  const outDir = outDirNative.split(path.sep).join('/');
  const split = `[0:v]split=${rungs.length}${rungs.map((_, i) => `[s${i}]`).join('')}`;
  const scales = rungs.map((r, i) => `[s${i}]scale=${r.w}:${r.h}[o${i}]`);
  const args = ['-i', input, '-filter_complex', [split, ...scales].join(';')];
  rungs.forEach((r, i) => {
    args.push('-map', `[o${i}]`, `-b:v:${i}`, `${r.kbps}k`, `-maxrate:v:${i}`, `${r.max}k`, `-bufsize:v:${i}`, `${r.max * 2}k`);
  });
  if (hasAudio) rungs.forEach(() => args.push('-map', '0:a:0'));
  args.push(
    '-c:v', 'libx264', '-preset', 'veryfast', '-profile:v', 'main', '-pix_fmt', 'yuv420p',
    // A keyframe every 2 s in every rendition, so the player can switch quality
    // at any piece boundary.
    '-force_key_frames', 'expr:gte(t,n_forced*2)', '-sc_threshold', '0',
    ...(hasAudio ? ['-c:a', 'aac', '-b:a', '96k', '-ac', '2'] : []),
    '-map_metadata', '-1',
    '-f', 'hls', '-hls_time', String(SEGMENT_SECONDS), '-hls_playlist_type', 'vod',
    '-hls_flags', 'independent_segments', '-hls_segment_type', 'mpegts',
    '-hls_segment_filename', `${outDir}/v%v/seg_%03d.ts`,
    '-master_pl_name', 'master.m3u8',
    '-var_stream_map', rungs.map((_, i) => (hasAudio ? `v:${i},a:${i}` : `v:${i}`)).join(' '),
    '-y', `${outDir}/v%v/index.m3u8`,
  );
  await run(ffmpegPath, args, { timeoutMs: ENCODE_TIMEOUT_MS });
}

async function verify(outDir, rungs, meta) {
  const master = path.join(outDir, 'master.m3u8');
  if (!existsSync(master)) throw new Error('master.m3u8 missing');
  const listed = readFileSync(master, 'utf8').split('\n').filter((l) => l.trim().endsWith('.m3u8'));
  if (listed.length !== rungs.length) throw new Error(`master lists ${listed.length} renditions, expected ${rungs.length}`);
  for (let i = 0; i < rungs.length; i++) {
    const pl = path.join(outDir, `v${i}`, 'index.m3u8');
    if (!existsSync(pl)) throw new Error(`rendition ${i} missing`);
    const text = readFileSync(pl, 'utf8');
    if (!text.includes('#EXT-X-ENDLIST')) throw new Error(`rendition ${i} not finished`);
    const secs = [...text.matchAll(/#EXTINF:([\d.]+)/g)].reduce((s, m) => s + parseFloat(m[1]), 0);
    if (Math.abs(secs - meta.duration) > 1.0) throw new Error(`rendition ${i} is ${secs.toFixed(1)}s, source ${meta.duration.toFixed(1)}s`);
  }
  const first = await probe(path.join(outDir, 'v0', 'seg_000.ts'));
  if (meta.hasAudio && !first.hasAudio) throw new Error('audio lost');
}

function listFiles(dir, prefix = '') {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) out.push(...listFiles(p, `${prefix}${name}/`));
    else out.push({ path: p, rel: `${prefix}${name}`, size: statSync(p).size });
  }
  return out;
}

async function uploadFolder(dir, keyPrefix) {
  const { PutObjectCommand } = await import('@aws-sdk/client-s3');
  const client = await getS3();
  const files = listFiles(dir);
  // Playlists last, master very last: the link only works once every piece is there.
  files.sort((a, b) => (a.rel === 'master.m3u8') - (b.rel === 'master.m3u8') || a.rel.endsWith('.m3u8') - b.rel.endsWith('.m3u8'));
  const pieces = files.filter((f) => !f.rel.endsWith('.m3u8'));
  const playlists = files.filter((f) => f.rel.endsWith('.m3u8'));
  const put = (f) => client.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: `${keyPrefix}${f.rel}`,
    Body: createReadStream(f.path),
    ContentLength: f.size,
    ContentType: f.rel.endsWith('.m3u8') ? 'application/vnd.apple.mpegurl' : 'video/mp2t',
    // Finished files never change (a re-encode would go to a new reel id anyway).
    CacheControl: 'public, max-age=31536000, immutable',
  }));
  const queue = [...pieces];
  await Promise.all(Array.from({ length: UPLOAD_CONCURRENCY }, async () => { while (queue.length) await put(queue.shift()); }));
  for (const f of playlists) await put(f);
  return files.reduce((s, f) => s + f.size, 0);
}

// ── failed list ───────────────────────────────────────────────────────────────
function readFailed() {
  try { return JSON.parse(readFileSync(FAILED_FILE, 'utf8')); } catch { return {}; }
}
function markFailed(id, message) {
  const f = readFailed();
  f[id] = { message: String(message).slice(0, 300), at: new Date().toISOString() };
  writeFileSync(FAILED_FILE, JSON.stringify(f, null, 1));
}

// ── one reel ──────────────────────────────────────────────────────────────────
async function processOne(v) {
  const loc = locateKey(v.videoUrl);
  if (!loc) throw new Error('video is not in S3');
  if (!HAVE_S3) throw new Error('S3 keys not available in this environment');
  const work = path.join(os.tmpdir(), `hls-${randomUUID()}`);
  const src = path.join(work, 'in.mp4'), out = path.join(work, 'out');
  mkdirSync(out, { recursive: true });
  try {
    const t0 = Date.now();
    await download(v.videoUrl, src);
    const srcBytes = statSync(src).size;
    const { meta, rungs } = await encodeHls(src, out);
    const t1 = Date.now();

    const keyPrefix = loc.key.replace(/\.[a-z0-9]+$/i, '') + '_hls/';
    const bytes = await uploadFolder(out, keyPrefix);
    const hlsUrl = `${loc.base}/${keyPrefix}master.m3u8`;
    const reach = await fetch(hlsUrl, { method: 'HEAD' });
    if (!reach.ok) throw new Error(`master.m3u8 not reachable (${reach.status})`);

    // The reel may have been deleted or rejected while it was being encoded.
    const res = await prisma.video.updateMany({ where: { id: v.id, deletedAt: null, status: 'APPROVED' }, data: { hlsUrl } });
    appendFileSync(LOG_FILE, JSON.stringify({ id: v.id, hlsUrl, renditions: rungs.map((r) => `${r.w}x${r.h}`), seconds: meta.duration, srcBytes, hlsBytes: bytes, linked: res.count === 1, at: new Date().toISOString() }) + '\n');
    log(`OK   ${v.id.slice(0, 8)}  ${Math.round(meta.duration)}s ${meta.width}x${meta.height} -> ${rungs.map((r) => r.h > r.w ? r.w + 'p' : r.h + 'p').join('/')}  `
      + `${mb(srcBytes)} MB mp4, ${mb(bytes)} MB hls  encode ${((t1 - t0) / 1000).toFixed(0)}s${res.count === 1 ? '' : '  (not linked: no longer approved)'}`);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

async function pending(take) {
  const failed = RETRY_FAILED ? {} : readFailed();
  const rows = await prisma.video.findMany({
    where: { deletedAt: null, status: 'APPROVED', hlsUrl: null, ...(ONLY ? { id: { in: [...ONLY] } } : {}) },
    select: { id: true, videoUrl: true, createdAt: true },
    orderBy: { createdAt: 'desc' }, // newest first: those are the ones being watched
    take: take + Object.keys(failed).length,
  });
  return rows.filter((r) => !failed[r.id]).slice(0, take);
}

// ── main ──────────────────────────────────────────────────────────────────────
let prisma = null;

async function main() {
  if (TEST_ENCODE) {
    const [input, outDir] = argv.filter((a) => !a.startsWith('--'));
    if (!input || !outDir) throw new Error('usage: --test-encode in.mp4 outDir');
    mkdirSync(outDir, { recursive: true });
    const t0 = Date.now();
    const { meta, rungs } = await encodeHls(input, outDir);
    const total = listFiles(outDir).reduce((s, f) => s + f.size, 0);
    log(`OK ${Math.round(meta.duration)}s ${meta.width}x${meta.height} -> ${rungs.map((r) => `${r.w}x${r.h}@${r.kbps}k`).join(', ')}  ${mb(total)} MB  in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    return;
  }

  const { PrismaClient } = await import('@prisma/client');
  prisma = new PrismaClient();

  if (CLEAR) {
    const where = ONLY ? { id: { in: [...ONLY] } } : { hlsUrl: { not: null } };
    const res = await prisma.video.updateMany({ where, data: { hlsUrl: null } });
    log(`Cleared hlsUrl on ${res.count} reel(s): the app plays their MP4 again. The HLS files are still in S3.`);
    return;
  }
  if (RETRY_FAILED) writeFileSync(FAILED_FILE, '{}');

  if (WATCH) {
    log(`Watching for approved reels without HLS (every ${WATCH_POLL_MS / 1000}s).`);
    for (;;) {
      try {
        const [v] = await pending(1);
        if (v) {
          try { await processOne(v); } catch (e) { markFailed(v.id, e.message); log(`FAIL ${v.id.slice(0, 8)}  ${e.message}`); }
          await sleep(2000);
          continue;
        }
      } catch (e) {
        log('Database/S3 problem, retrying in a minute:', e.message);
      }
      await sleep(WATCH_POLL_MS);
    }
  }

  const todo = await pending(Number.isFinite(LIMIT) ? LIMIT : 100000);
  log(`${ONCE ? 'CONVERT' : 'DRY RUN'}: ${todo.length} approved reel(s) without HLS${Object.keys(readFailed()).length ? ` (skipping ${Object.keys(readFailed()).length} that failed before; --retry-failed to include)` : ''}`);
  if (!ONCE) { todo.slice(0, 20).forEach((v) => log(`  ${v.id.slice(0, 8)}  ${v.videoUrl}`)); log('Nothing was changed. Re-run with --once to convert.'); return; }

  let ok = 0, failed = 0;
  for (const [i, v] of todo.entries()) {
    process.stdout.write(`[${i + 1}/${todo.length}] `);
    try { await processOne(v); ok++; } catch (e) { failed++; markFailed(v.id, e.message); log(`FAIL ${v.id.slice(0, 8)}  ${e.message}`); }
    await sleep(2000);
  }
  log(`Done. converted=${ok} failed=${failed}. Log: ${path.basename(LOG_FILE)}. Undo all: --clear`);
}

try { await main(); } finally { await prisma?.$disconnect(); }

// pm2 (on the web server, from ~/app):
//   pm2 start scripts/hls-worker.mjs --name hls-worker --interpreter node \
//     --node-args="" -- --watch && pm2 save
// and lower its CPU priority so the website always comes first:
//   renice -n 19 -p $(pm2 pid hls-worker)
