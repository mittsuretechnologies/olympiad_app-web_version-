import { spawn } from 'child_process';
import { open, stat, unlink } from 'fs/promises';
import { probeVideo } from '@/lib/videoProbe';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ffmpegPath: string = require('ffmpeg-static');

// Re-encodes an uploaded video into a size a phone can stream.
//
// Why: the reels feed was playing 4K / 1080p originals of 40+ Mbps (up to
// 250 MB for 52 seconds). A phone on mobile data cannot download that as fast
// as it plays, so the reel stalls. Everything the app uploads now ends up at
// roughly 720p / 2.5 Mbps, with the index at the front of the file so
// playback starts straight away.
//
// A video that is already light is never touched, so a normal phone recording
// that the app compressed costs no extra time here.

/** Longest side, in pixels, a published video may have. */
export const MAX_LONG_EDGE = 1280;
/** Above this average bitrate (kbps) a video is re-encoded. */
export const MAX_KBPS = 3500;
/** Bitrate ceiling (kbps) the re-encode aims for. */
const TARGET_MAXRATE_KBPS = 2500;
/** A re-encode that runs longer than this is abandoned and the original published. */
const ENCODE_TIMEOUT_MS = 150_000;
/** How many encodes may run at once — the server only has 2 CPUs. */
const MAX_CONCURRENT_ENCODES = 2;

export type OptimizePlan =
  | { action: 'none'; reason: string }
  | { action: 'remux'; reason: string }
  | { action: 'encode'; reason: string };

export interface InspectResult {
  plan: OptimizePlan;
  width: number;
  height: number;
  durationSeconds: number;
  kbps: number;
  sizeBytes: number;
  moovAtFront: boolean;
}

/** True when the MP4/MOV index ("moov") comes before the media data ("mdat"). */
async function indexIsAtFront(filePath: string): Promise<boolean> {
  const fh = await open(filePath, 'r');
  try {
    const buf = Buffer.alloc(1024 * 1024);
    const { bytesRead } = await fh.read(buf, 0, buf.length, 0);
    const head = buf.subarray(0, bytesRead);
    const moov = head.indexOf('moov');
    const mdat = head.indexOf('mdat');
    return moov >= 0 && (mdat < 0 || moov < mdat);
  } finally {
    await fh.close();
  }
}

/** Looks at a local video file and decides what, if anything, to do to it. */
export async function inspectForStreaming(filePath: string): Promise<InspectResult> {
  const [meta, info, front] = await Promise.all([
    probeVideo(filePath),
    stat(filePath),
    indexIsAtFront(filePath).catch(() => true),
  ]);
  const longEdge = Math.max(meta.width || 0, meta.height || 0);
  const kbps = meta.durationSeconds > 0 ? (info.size * 8) / meta.durationSeconds / 1000 : 0;

  let plan: OptimizePlan;
  if (longEdge > MAX_LONG_EDGE) {
    plan = { action: 'encode', reason: `${longEdge}px is above ${MAX_LONG_EDGE}px` };
  } else if (kbps > MAX_KBPS) {
    plan = { action: 'encode', reason: `${Math.round(kbps)} kbps is above ${MAX_KBPS} kbps` };
  } else if (!front) {
    plan = { action: 'remux', reason: 'index is at the end of the file' };
  } else {
    plan = { action: 'none', reason: 'already light' };
  }

  return {
    plan,
    width: meta.width,
    height: meta.height,
    durationSeconds: meta.durationSeconds,
    kbps,
    sizeBytes: info.size,
    moovAtFront: front,
  };
}

// Simple counting semaphore so several uploads finishing together do not all
// start an encode and starve the web server of CPU.
let active = 0;
const waiting: Array<() => void> = [];

export async function withEncodeSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= MAX_CONCURRENT_ENCODES) {
    await new Promise<void>((resolve) => waiting.push(resolve));
  }
  active += 1;
  try {
    return await fn();
  } finally {
    active -= 1;
    waiting.shift()?.();
  }
}

function runFfmpeg(args: string[], timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, args);
    let stderr = '';
    proc.stderr.on('data', (d) => { stderr = (stderr + d.toString()).slice(-2000); });
    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      reject(new Error(`ffmpeg timed out after ${Math.round(timeoutMs / 1000)}s`));
    }, timeoutMs);
    proc.on('error', (e) => { clearTimeout(timer); reject(e); });
    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}: ${stderr}`));
    });
  });
}

export interface TranscodeOptions {
  /** 0 = left edge … 1 = right edge. When set, a 9:16 slice is cut out first. */
  cropX?: number | null;
}

/**
 * Re-encodes `inputPath` to `outputPath` (MP4, H.264 + AAC, <=1280px long edge,
 * ~2.5 Mbps, index first). Optionally crops a portrait slice out of a
 * landscape video in the same pass.
 */
export async function transcodeForStreaming(
  inputPath: string,
  outputPath: string,
  opts: TranscodeOptions = {},
): Promise<void> {
  const filters: string[] = [];
  if (typeof opts.cropX === 'number') {
    const x = Math.min(1, Math.max(0, opts.cropX));
    // min() keeps it safe if the video is not landscape after all. Quoted
    // because a bare comma separates filters in an ffmpeg filter graph.
    filters.push(`crop=w='min(iw,trunc(ih*9/32)*2)':h=trunc(ih/2)*2:x=(iw-ow)*${x.toFixed(4)}:y=0`);
  }
  // Long edge capped at MAX_LONG_EDGE, never scaled up, even dimensions.
  filters.push(
    `scale=w='if(gte(iw,ih),min(${MAX_LONG_EDGE},iw),-2)':h='if(gte(iw,ih),-2,min(${MAX_LONG_EDGE},ih))'`,
  );

  await runFfmpeg([
    '-i', inputPath,
    '-map', '0:v:0', '-map', '0:a:0?',
    '-vf', filters.join(','),
    '-c:v', 'libx264', '-preset', 'veryfast', '-profile:v', 'high',
    '-crf', '24', '-maxrate', `${TARGET_MAXRATE_KBPS}k`, '-bufsize', `${TARGET_MAXRATE_KBPS * 2}k`,
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '96k', '-ac', '2',
    // Phone recordings carry GPS and device info — not needed for playback.
    '-map_metadata', '-1',
    '-movflags', '+faststart',
    '-y', outputPath,
  ], ENCODE_TIMEOUT_MS);
}

/** Moves the index to the front without touching the picture (takes seconds). */
export async function remuxFaststart(inputPath: string, outputPath: string): Promise<void> {
  await runFfmpeg([
    '-i', inputPath,
    '-map', '0:v:0', '-map', '0:a:0?',
    '-c', 'copy',
    '-movflags', '+faststart',
    '-y', outputPath,
  ], 60_000);
}

export type OptimizeOutcome = 'none' | 'remux' | 'encode' | 'failed';

/**
 * One call for the upload routes: looks at `inputPath` and, when needed,
 * writes a streaming-friendly copy to `outputPath`. Returns what happened:
 *   'none'   — already light; `outputPath` was not written, publish the input
 *   'remux'  — index moved to the front; publish `outputPath`
 *   'encode' — re-encoded (and cropped, if cropX was given); publish `outputPath`
 *   'failed' — something went wrong; `outputPath` is not usable, publish the input
 *
 * Never throws: an upload must not be lost because optimising it failed.
 * `cropX` forces a re-encode (the user asked for a crop).
 */
export async function optimizeForStreaming(
  inputPath: string,
  outputPath: string,
  cropX: number | null = null,
): Promise<OptimizeOutcome> {
  try {
    let action: 'none' | 'remux' | 'encode' = cropX !== null ? 'encode' : 'none';
    if (cropX === null) {
      const info = await inspectForStreaming(inputPath);
      action = info.plan.action;
      console.log(
        `[video-optimize] ${info.width}x${info.height} ${(info.sizeBytes / 1048576).toFixed(1)}MB `
        + `${Math.round(info.kbps)}kbps -> ${action} (${info.plan.reason})`,
      );
    }
    if (action === 'none') return 'none';

    if (action === 'remux') {
      await remuxFaststart(inputPath, outputPath);
      return 'remux';
    }

    await withEncodeSlot(() => transcodeForStreaming(inputPath, outputPath, { cropX }));
    // Re-encoding should only ever make the file lighter. If it somehow did not
    // (already tightly compressed), keep the input — except for a crop, where
    // the picture itself was meant to change.
    if (cropX === null) {
      const [before, after] = await Promise.all([stat(inputPath), stat(outputPath)]);
      if (after.size >= before.size) {
        await unlink(outputPath).catch(() => {});
        return 'none';
      }
    }
    return 'encode';
  } catch (err) {
    console.error('[video-optimize] failed, publishing the original:', err);
    await unlink(outputPath).catch(() => {});
    return 'failed';
  }
}
