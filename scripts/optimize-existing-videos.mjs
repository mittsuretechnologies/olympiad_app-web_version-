#!/usr/bin/env node
// One-off job: bring videos that were uploaded BEFORE the upload-time
// optimiser (src/lib/videoOptimize.ts) down to a size a phone can stream.
//
//   node scripts/optimize-existing-videos.mjs                 dry run: list only, changes nothing
//   node scripts/optimize-existing-videos.mjs --apply         re-encode + switch links (one at a time)
//   node scripts/optimize-existing-videos.mjs --apply --limit 3 --only id1,id2
//   node scripts/optimize-existing-videos.mjs --rollback optimize-log-XXXX.jsonl
//
// Run from the app folder (it reads ./.env). On the server use low priority:
//   nice -n 19 node scripts/optimize-existing-videos.mjs --apply
//
// What --apply does, per video that needs it:
//   1. downloads the original            (the original is never modified or deleted)
//   2. re-encodes it (same settings as new uploads — keep in sync with videoOptimize.ts)
//   3. verifies the result (readable, same length, audio kept, smaller, <=1280px)
//   4. uploads it next to the original as <name>_opt.mp4
//   5. points the video's link at the new file, and appends the old->new link to a log
// It stops at the first problem unless --continue-on-error is given.

import { readFileSync, existsSync, mkdirSync, createWriteStream, appendFileSync, writeFileSync, statSync, unlinkSync, createReadStream } from 'node:fs';
import { open, stat, unlink, copyFile, readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';

// ── settings: keep identical to src/lib/videoOptimize.ts ─────────────────────
const MAX_LONG_EDGE = 1280;
const MAX_KBPS = 3500;
const TARGET_MAXRATE_KBPS = 2500;
const ENCODE_TIMEOUT_MS = 20 * 60 * 1000; // generous: runs at low priority, one at a time
const PROBE_BYTES = 6 * 1024 * 1024;

// ── args ──────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const flag = (n) => argv.includes(`--${n}`);
const opt = (n) => {
  const i = argv.indexOf(`--${n}`);
  if (i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--')) return argv[i + 1];
  const eq = argv.find((a) => a.startsWith(`--${n}=`));
  return eq ? eq.split('=').slice(1).join('=') : null;
};
const APPLY = flag('apply');
const LIMIT = opt('limit') ? parseInt(opt('limit'), 10) : Infinity;
const ONLY = opt('only') ? new Set(opt('only').split(',')) : null;
const INCLUDE_HOME = !flag('no-home');
const CONTINUE = flag('continue-on-error');
const ROLLBACK = opt('rollback');
// --min-kbps N : only re-encode videos at or above N kbps (the resolution rule is then
//                ignored). Videos already near 720p / 3-4 Mbps are left alone: re-encoding
//                them saves little and costs some quality. Index-at-end files still get
//                the lossless index move.
const MIN_KBPS = opt('min-kbps') ? parseInt(opt('min-kbps'), 10) : 0;
const SKIP_REJECTED = flag('skip-rejected'); // nobody can see a rejected video
const SAMPLE = opt('sample') ? parseInt(opt('sample'), 10) : null; // inspect only the first N (testing)

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

const { PrismaClient } = await import('@prisma/client');
const prisma = new PrismaClient();
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
  const out = await run(ffprobePath, ['-v', 'error', '-print_format', 'json', '-show_entries', 'format=duration:stream=width,height,codec_type', file], { capture: true });
  const j = JSON.parse(out);
  const v = (j.streams || []).find((s) => s.codec_type === 'video');
  if (!v) throw new Error('no video stream');
  return {
    duration: parseFloat(j.format?.duration) || 0,
    width: v.width || 0,
    height: v.height || 0,
    hasAudio: (j.streams || []).some((s) => s.codec_type === 'audio'),
  };
}

async function indexAtFront(file) {
  const fh = await open(file, 'r');
  try {
    const buf = Buffer.alloc(1024 * 1024);
    const { bytesRead } = await fh.read(buf, 0, buf.length, 0);
    const head = buf.subarray(0, bytesRead);
    const moov = head.indexOf('moov'), mdat = head.indexOf('mdat');
    return moov >= 0 && (mdat < 0 || moov < mdat);
  } finally { await fh.close(); }
}

function classify(m, sizeBytes, front) {
  const longEdge = Math.max(m.width, m.height);
  const kbps = m.duration > 0 ? (sizeBytes * 8) / m.duration / 1000 : 0;
  if (MIN_KBPS > 0) {
    if (kbps >= MIN_KBPS) return { action: 'encode', reason: `${Math.round(kbps)} kbps >= ${MIN_KBPS}`, kbps, longEdge };
    if (!front) return { action: 'remux', reason: 'index at end', kbps, longEdge };
    return { action: 'none', reason: `below ${MIN_KBPS} kbps`, kbps, longEdge };
  }
  if (longEdge > MAX_LONG_EDGE) return { action: 'encode', reason: `${longEdge}px > ${MAX_LONG_EDGE}px`, kbps, longEdge };
  if (kbps > MAX_KBPS) return { action: 'encode', reason: `${Math.round(kbps)} kbps > ${MAX_KBPS}`, kbps, longEdge };
  if (!front) return { action: 'remux', reason: 'index at end', kbps, longEdge };
  return { action: 'none', reason: 'already light', kbps, longEdge };
}

// Where is this video's file? S3 (reachable through its public CloudFront URL for reads),
// or a legacy file on this server's disk under public/uploads.
function locate(url) {
  try {
    const u = new URL(url);
    if (u.pathname.startsWith('/uploads/') && !PUBLIC_BASES.some((b) => url.startsWith(b))) {
      const p = path.join(process.cwd(), 'public', decodeURIComponent(u.pathname));
      if (existsSync(p)) return { kind: 'local', path: p, key: u.pathname.replace(/^\//, '') };
    }
  } catch { /* not a URL */ }
  for (const base of PUBLIC_BASES) {
    if (url.startsWith(base + '/')) return { kind: 's3', key: decodeURIComponent(url.slice(base.length + 1).split('?')[0]) };
  }
  if (/^https?:\/\//.test(url)) {
    // e.g. a CloudFront domain other than S3_PUBLIC_URL: still an S3 object, key = path.
    const key = decodeURIComponent(new URL(url).pathname.replace(/^\//, ''));
    if (key.startsWith('uploads/')) return { kind: 's3', key };
  }
  return { kind: 'unknown' };
}

async function headSize(url) {
  const r = await fetch(url, { method: 'HEAD' });
  if (!r.ok) throw new Error(`HEAD ${r.status}`);
  return parseInt(r.headers.get('content-length') || '0', 10);
}

async function downloadRange(url, dest, bytes) {
  const r = await fetch(url, bytes ? { headers: { Range: `bytes=0-${bytes - 1}` } } : {});
  if (!(r.ok || r.status === 206) || !r.body) throw new Error(`GET ${r.status}`);
  await pipeline(Readable.fromWeb(r.body), createWriteStream(dest));
}

// ── inspection (works on a partial download; falls back to the whole file) ───
async function inspect(item) {
  const loc = locate(item.videoUrl);
  if (loc.kind === 'unknown') return { ...item, loc, skip: 'cannot locate file' };
  const tmp = path.join(os.tmpdir(), `opt-probe-${randomUUID()}.mp4`);
  try {
    let size, src = loc.kind === 'local' ? loc.path : null;
    if (loc.kind === 'local') size = statSync(src).size;
    else size = await headSize(item.videoUrl);
    if (!size) return { ...item, loc, skip: 'empty / missing file' };
    if (/_opt\.mp4$/i.test(item.videoUrl)) return { ...item, loc, size, skip: 'already optimised' };

    let m, front;
    const attempt = async (file) => ({ m: await probe(file), front: await indexAtFront(file) });
    try {
      if (!src) { await downloadRange(item.videoUrl, tmp, Math.min(PROBE_BYTES, size)); src = tmp; }
      ({ m, front } = await attempt(src));
      if (!m.duration) throw new Error('no duration');
    } catch {
      // Index is at the end of the file (or the head was not enough): need all of it.
      if (loc.kind === 's3') { await downloadRange(item.videoUrl, tmp, 0); src = tmp; }
      ({ m, front } = await attempt(src));
    }
    return { ...item, loc, size, meta: m, front, plan: classify(m, size, front) };
  } catch (e) {
    return { ...item, loc, skip: `probe failed: ${String(e.message).slice(0, 80)}` };
  } finally {
    await unlink(tmp).catch(() => {});
  }
}

// ── the actual work ───────────────────────────────────────────────────────────
async function encode(input, output) {
  try {
    await encodeOnce(input, output);
  } catch (e) {
    // Some phones write a colour-range tag ffmpeg refuses ("Invalid color range").
    // Rewrite just that tag (lossless copy) and encode from the copy. Same as videoOptimize.ts.
    if (!String(e.message).includes('Invalid color range')) throw e;
    const fixed = output + '.range-fixed.mp4';
    try {
      await run(ffmpegPath, ['-i', input, '-bsf:v', 'h264_metadata=video_full_range_flag=0:colour_primaries=1:transfer_characteristics=1:matrix_coefficients=1', '-c', 'copy', '-y', fixed], { timeoutMs: 10 * 60 * 1000 });
      await encodeOnce(fixed, output);
    } finally { await unlink(fixed).catch(() => {}); }
  }
}
async function encodeOnce(input, output) {
  const vf = `scale=w='if(gte(iw,ih),min(${MAX_LONG_EDGE},iw),-2)':h='if(gte(iw,ih),-2,min(${MAX_LONG_EDGE},ih))'`;
  await run(ffmpegPath, [
    '-i', input, '-map', '0:v:0', '-map', '0:a:0?', '-vf', vf,
    '-c:v', 'libx264', '-preset', 'veryfast', '-profile:v', 'high',
    '-crf', '24', '-maxrate', `${TARGET_MAXRATE_KBPS}k`, '-bufsize', `${TARGET_MAXRATE_KBPS * 2}k`,
    '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '96k', '-ac', '2',
    '-map_metadata', '-1', '-movflags', '+faststart', '-y', output,
  ], { timeoutMs: ENCODE_TIMEOUT_MS });
}
async function remux(input, output) {
  await run(ffmpegPath, ['-i', input, '-map', '0:v:0', '-map', '0:a:0?', '-c', 'copy', '-movflags', '+faststart', '-y', output], { timeoutMs: 10 * 60 * 1000 });
}

function newKeyFor(key) { return key.replace(/\.[a-z0-9]+$/i, '') + '_opt.mp4'; }

async function processOne(r, logFile) {
  const work = path.join(os.tmpdir(), `opt-work-${randomUUID()}`);
  mkdirSync(work);
  const src = path.join(work, 'in.mp4'), out = path.join(work, 'out.mp4');
  try {
    if (r.loc.kind === 'local') await copyFile(r.loc.path, src);
    else await downloadRange(r.videoUrl, src, 0);

    if (r.plan.action === 'remux') await remux(src, out);
    else await encode(src, out);

    // verify before anything is published
    const before = await probe(src), after = await probe(out);
    const outSize = (await stat(out)).size;
    if (Math.abs(after.duration - before.duration) > 0.75) throw new Error(`duration changed ${before.duration}s -> ${after.duration}s`);
    if (before.hasAudio && !after.hasAudio) throw new Error('audio lost');
    if (Math.max(after.width, after.height) > MAX_LONG_EDGE && r.plan.action === 'encode') throw new Error('still too large');
    if (r.plan.action === 'encode' && outSize >= r.size * 0.9) throw new Error(`not smaller (${mb(outSize)} MB vs ${mb(r.size)} MB)`);
    if (!(await indexAtFront(out))) throw new Error('index not at front');

    let newUrl;
    if (r.loc.kind === 'local') {
      const destPath = r.loc.path.replace(/\.[a-z0-9]+$/i, '') + '_opt.mp4';
      await copyFile(out, destPath);
      newUrl = r.videoUrl.replace(/\.[a-z0-9]+(\?.*)?$/i, '') + '_opt.mp4';
    } else {
      if (!HAVE_S3) throw new Error('S3 keys not available in this environment');
      const { PutObjectCommand, HeadObjectCommand } = await import('@aws-sdk/client-s3');
      const client = await getS3();
      const key = newKeyFor(r.loc.key);
      await client.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: createReadStream(out), ContentLength: outSize, ContentType: 'video/mp4', CacheControl: 'public, max-age=604800' }));
      const head = await client.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
      if (head.ContentLength !== outSize) throw new Error('uploaded size mismatch');
      const base = PUBLIC_BASES[0];
      // keep the same host the old link used
      const oldBase = PUBLIC_BASES.find((b) => r.videoUrl.startsWith(b + '/')) || (new URL(r.videoUrl).origin);
      newUrl = `${oldBase}/${key}`;
      void base;
    }

    // the new file must really be reachable before the link is switched
    const reach = await fetch(newUrl, { method: 'HEAD' });
    if (!reach.ok) throw new Error(`new file not reachable (${reach.status})`);

    appendFileSync(logFile, JSON.stringify({ table: r.table, id: r.id, oldUrl: r.videoUrl, newUrl, oldBytes: r.size, newBytes: outSize, at: new Date().toISOString() }) + '\n');
    if (r.table === 'homeSectionVideo') await prisma.homeSectionVideo.update({ where: { id: r.id }, data: { videoUrl: newUrl } });
    else await prisma.video.update({ where: { id: r.id }, data: { videoUrl: newUrl } });
    return { oldBytes: r.size, newBytes: outSize };
  } finally {
    await unlink(src).catch(() => {}); await unlink(out).catch(() => {});
    try { (await import('node:fs')).rmdirSync(work); } catch { /* ignore */ }
  }
}

// ── main ──────────────────────────────────────────────────────────────────────
async function main() {
  if (ROLLBACK) {
    const lines = (await readFile(ROLLBACK, 'utf8')).split('\n').filter(Boolean).map((l) => JSON.parse(l));
    console.log(`Rolling back ${lines.length} link(s) from ${ROLLBACK}`);
    for (const e of lines.reverse()) {
      if (e.table === 'homeSectionVideo') await prisma.homeSectionVideo.update({ where: { id: e.id }, data: { videoUrl: e.oldUrl } });
      else await prisma.video.update({ where: { id: e.id }, data: { videoUrl: e.oldUrl } });
      console.log('  restored', e.id.slice(0, 8));
    }
    return;
  }

  const items = [];
  const vids = await prisma.video.findMany({
    where: { deletedAt: null },
    select: { id: true, videoUrl: true, status: true, uploaderType: true, isEvaluation: true, createdAt: true, caption: true },
    orderBy: { createdAt: 'desc' },
  });
  for (const v of vids) items.push({ table: 'video', ...v });
  if (INCLUDE_HOME) {
    const hv = await prisma.homeSectionVideo.findMany({ select: { id: true, videoUrl: true, title: true, section: true, createdAt: true } });
    for (const v of hv) items.push({ table: 'homeSectionVideo', status: v.section, uploaderType: 'ADMIN', isEvaluation: false, caption: v.title, ...v });
  }
  if (SKIP_REJECTED) { for (let i = items.length - 1; i >= 0; i--) if (items[i].status === 'REJECTED') items.splice(i, 1); }
  let pool = ONLY ? items.filter((i) => ONLY.has(i.id) || ONLY.has(i.id.slice(0, 8))) : items;
  if (SAMPLE) pool = pool.slice(0, SAMPLE);
  console.log(`${APPLY ? 'APPLY' : 'DRY RUN'}: ${pool.length} videos in the database (${vids.length} reels${INCLUDE_HOME ? ', ' + (items.length - vids.length) + ' Learning/Parenting' : ''})`);

  // inspect (a few at a time: each is a small partial download)
  const results = [];
  const queue = [...pool];
  let done = 0;
  async function worker() {
    while (queue.length) {
      const it = queue.shift();
      results.push(await inspect(it));
      if (++done % 20 === 0) console.log(`  inspected ${done}/${pool.length}`);
    }
  }
  await Promise.all(Array.from({ length: 4 }, worker));

  const ok = results.filter((r) => r.plan);
  const todo = ok.filter((r) => r.plan.action !== 'none').sort((a, b) => b.size - a.size);
  const skipped = results.filter((r) => r.skip);
  const totalBytes = ok.reduce((s, r) => s + r.size, 0);
  const saving = todo.reduce((s, r) => r.plan.action === 'encode' ? s + (r.size - Math.min(r.size, (r.meta.duration * TARGET_MAXRATE_KBPS * 1000) / 8)) : s, 0);

  console.log(`\nInspected OK: ${ok.length}   skipped: ${skipped.length}   total size: ${mb(totalBytes)} MB`);
  console.log(`NEED WORK: ${todo.length} videos, ${mb(todo.reduce((s, r) => s + r.size, 0))} MB  -> expected saving about ${mb(saving)} MB`);
  console.log(`\n${'#'.padStart(2)} ${'MB'.padStart(7)} ${'len'.padStart(5)} ${'Mbps'.padStart(5)} ${'res'.padStart(10)}  ${'plan'.padEnd(6)} ${'table'.padEnd(7)} ${'status'.padEnd(9)} ${'eval'.padEnd(4)} id`);
  todo.forEach((r, i) => {
    console.log(`${String(i + 1).padStart(2)} ${mb(r.size).padStart(7)} ${(Math.round(r.meta.duration) + 's').padStart(5)} ${(r.plan.kbps / 1000).toFixed(1).padStart(5)} ${(r.meta.width + 'x' + r.meta.height).padStart(10)}  ${r.plan.action.padEnd(6)} ${r.table.slice(0, 7).padEnd(7)} ${String(r.status).slice(0, 9).padEnd(9)} ${(r.isEvaluation ? 'yes' : '').padEnd(4)} ${r.id.slice(0, 8)}`);
  });
  if (skipped.length) {
    const by = {}; skipped.forEach((s) => { by[s.skip] = (by[s.skip] || 0) + 1; });
    console.log('\nSkipped:', by);
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportFile = path.join(process.cwd(), `optimize-report-${stamp}.json`);
  writeFileSync(reportFile, JSON.stringify(todo.map((r) => ({ table: r.table, id: r.id, url: r.videoUrl, bytes: r.size, plan: r.plan.action, reason: r.plan.reason, seconds: r.meta.duration, w: r.meta.width, h: r.meta.height, status: r.status, evaluation: r.isEvaluation })), null, 1));
  console.log(`\nReport written: ${reportFile}`);

  if (!APPLY) { console.log('\nDRY RUN — nothing was changed. Re-run with --apply to process.'); return; }

  // apply
  const logFile = path.join(process.cwd(), `optimize-log-${stamp}.jsonl`);
  console.log(`\nApplying to up to ${Math.min(LIMIT, todo.length)} video(s). Link log: ${logFile}\n`);
  let n = 0, savedBytes = 0, failed = 0;
  for (const r of todo) {
    if (n >= LIMIT) break;
    n++;
    const t0 = Date.now();
    try {
      const res = await processOne(r, logFile);
      savedBytes += res.oldBytes - res.newBytes;
      console.log(`[${n}/${Math.min(LIMIT, todo.length)}] OK   ${r.id.slice(0, 8)}  ${mb(res.oldBytes)} MB -> ${mb(res.newBytes)} MB  (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
    } catch (e) {
      failed++;
      console.log(`[${n}/${Math.min(LIMIT, todo.length)}] FAIL ${r.id.slice(0, 8)}  ${e.message}`);
      if (!CONTINUE) { console.log('Stopping at the first failure. Nothing else was changed.'); break; }
    }
    await sleep(2000);
  }
  console.log(`\nDone. processed=${n} failed=${failed} saved about ${mb(savedBytes)} MB. Undo with: --rollback ${path.basename(logFile)}`);
}

try { await main(); } finally { await prisma.$disconnect(); }
