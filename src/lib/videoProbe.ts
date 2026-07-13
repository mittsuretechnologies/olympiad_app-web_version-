import { spawn } from 'child_process';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ffmpegPath: string = require('ffmpeg-static');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ffprobePath: string = require('ffprobe-static').path;

export interface VideoMeta {
  durationSeconds: number;
  width: number;
  height: number;
}

// Runs ffprobe and returns duration + the first video stream's dimensions
// (rotation-corrected — ffprobe reports post-rotation width/height when the
// stream carries a display-matrix/rotate tag, which is what actually renders).
export function probeVideo(filePath: string): Promise<VideoMeta> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffprobePath, [
      '-v', 'error',
      '-print_format', 'json',
      '-show_entries', 'format=duration:stream=width,height,codec_type',
      filePath,
    ]);

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', d => { stdout += d; });
    proc.stderr.on('data', d => { stderr += d; });

    proc.on('close', code => {
      if (code !== 0) return reject(new Error(`ffprobe failed: ${stderr}`));
      try {
        const parsed = JSON.parse(stdout);
        const videoStream = parsed.streams?.find((s: any) => s.codec_type === 'video');
        if (!videoStream) return reject(new Error('No video stream found'));
        resolve({
          durationSeconds: parseFloat(parsed.format?.duration) || 0,
          width: videoStream.width,
          height: videoStream.height,
        });
      } catch (e) {
        reject(e);
      }
    });
    proc.on('error', reject);
  });
}

// Center-crops the video to a 9:16 aspect ratio and re-encodes it.
export function cropTo9x16(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // crop=ih*9/16:ih (if source is wider than 9:16) or crop=iw:iw*16/9 (if taller) —
    // this expression picks whichever crop keeps the frame within source bounds.
    const cropFilter = "crop='min(iw,ih*9/16)':'min(ih,iw*16/9)'";
    const proc = spawn(ffmpegPath, [
      '-i', inputPath,
      '-vf', cropFilter,
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '23',
      '-c:a', 'copy',
      '-y',
      outputPath,
    ]);
    let stderr = '';
    proc.stderr.on('data', d => { stderr += d; });
    proc.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg crop failed: ${stderr}`));
    });
    proc.on('error', reject);
  });
}

// Re-encodes at a lower bitrate to bring file size under the target, using
// two-pass-free CRF+maxrate (good enough for a 150MB → ~140MB compression target).
export function compressVideo(inputPath: string, outputPath: string, targetBitrateKbps: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, [
      '-i', inputPath,
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-b:v', `${targetBitrateKbps}k`,
      '-maxrate', `${targetBitrateKbps}k`,
      '-bufsize', `${targetBitrateKbps * 2}k`,
      '-c:a', 'aac',
      '-b:a', '128k',
      '-y',
      outputPath,
    ]);
    let stderr = '';
    proc.stderr.on('data', d => { stderr += d; });
    proc.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg compress failed: ${stderr}`));
    });
    proc.on('error', reject);
  });
}
