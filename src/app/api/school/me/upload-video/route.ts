import { NextResponse } from 'next/server';
import { verify } from 'jsonwebtoken';
import { mkdir, unlink, rename } from 'fs/promises';
import { createWriteStream } from 'fs';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import type { ReadableStream as NodeWebReadableStream } from 'stream/web';
import path from 'path';
import { spawn } from 'child_process';
import { probeVideo } from '@/lib/videoProbe';
import { prisma } from '@/lib/prisma';
import { inactiveSchoolResponse } from '@/lib/auth-guard';
import { s3Enabled, uploadFileToS3 } from '@/lib/s3';
import { optimizeForStreaming } from '@/lib/videoOptimize';
import { getJwtSecret } from '@/lib/jwt-secret';
import { MAX_VIDEO_SECONDS } from '@/lib/uploadRules';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ffmpegPath: string = require('ffmpeg-static');

const JWT_SECRET      = getJwtSecret();
// Same rule as the app's own upload (COMPRESSION_OPTIONS in the app's
// Components/screens/app/UploadScreen.js): up to 10 MB is published as
// uploaded; anything larger is cut to 1280px on the long side (720p) at about
// 3 Mbps. Keep these two in step with the app. No hard upper cap on uploads.
const COMPRESS_ABOVE_BYTES = 10 * 1024 * 1024; // 10 MB  — app: minimumFileSizeForCompress: 10
const COMPRESS_MAXRATE_KBPS = 3000;           // 3 Mbps — app: bitrate: 3_000_000 (long edge 1280 = app maxSize)

export const dynamic     = 'force-dynamic';
// Compressing / cropping a long video takes a while (same allowance as the
// app's /api/app/upload-video/finalize).
export const maxDuration = 300;

function getSchoolFromToken(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  try {
    const decoded = verify(token, JWT_SECRET) as any;
    if (decoded.role !== 'SCHOOL') return null;
    return decoded;
  } catch {
    return null;
  }
}

function extractThumbnail(videoPath: string, thumbPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, [
      '-ss', '00:00:01',
      '-i', videoPath,
      '-frames:v', '1',
      '-vf', 'scale=640:-1',
      '-q:v', '3',
      '-y',
      thumbPath,
    ]);
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}`));
    });
    proc.on('error', reject);
  });
}

export async function POST(request: Request) {
  const school = getSchoolFromToken(request);
  if (!school) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const blocked = await inactiveSchoolResponse(school.id);
  if (blocked) return blocked;

  try {
    const formData  = await request.formData();
    const file       = formData.get('video') as File | null;
    const studentId  = formData.get('studentId') as string | null;
    // Same as the app's crop screen (/api/app/upload-video/finalize): a
    // landscape video is cut to the 9:16 part the school chose, x from 0 (left
    // edge) to 1 (right edge). Without it, the video is kept as it is.
    const rawCropX   = Number(formData.get('cropX'));
    const cropX: number | null = formData.get('cropX') != null && isFinite(rawCropX)
      ? Math.min(1, Math.max(0, rawCropX))
      : null;

    if (!file || file.size === 0) {
      return NextResponse.json({ error: 'No video file received' }, { status: 400 });
    }
    // own=true: the school's own video (no student; saved by POST /own-videos),
    // kept in the school's own folder. school.id comes from the signed token.
    const ownVideo = formData.get('own') === 'true';
    if (!ownVideo && !studentId) {
      return NextResponse.json({ error: 'studentId is required' }, { status: 400 });
    }

    let folder: string;
    if (ownVideo) {
      if (!/^[0-9a-f-]{36}$/i.test(String(school.id))) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      folder = `school_${school.id}`;
    } else {
      // Verify studentId belongs to this school (web-registered Student or
      // app-registered AppUser, mirroring the ownership check in POST /videos)
      // before it's used to build a filesystem path — this blocks both
      // cross-school disk writes and directory-traversal via a crafted value.
      const webStudent = await prisma.student.findUnique({
        where: { id: studentId! },
        select: { allocation: { select: { schoolId: true } } },
      });
      const ownsAsStudent = webStudent && webStudent.allocation?.schoolId === school.id;

      let ownsAsAppUser = false;
      if (!ownsAsStudent) {
        const appUser = await prisma.appUser.findUnique({
          where: { id: studentId! },
          select: { olympiadId: true },
        });
        if (appUser?.olympiadId) {
          const allocation = await prisma.olympiadIdAllocation.findUnique({
            where: { code: appUser.olympiadId },
            select: { schoolId: true },
          });
          ownsAsAppUser = allocation?.schoolId === school.id;
        }
      }

      if (!ownsAsStudent && !ownsAsAppUser) {
        return NextResponse.json({ error: 'Student not found for this school' }, { status: 403 });
      }
      folder = studentId!;
    }

    // Letters/digits only: the extension comes from the uploaded file's name.
    const ext        = (file.name.split('.').pop() || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'mp4';
    const baseName    = `${Date.now()}_school_${school.id.slice(0, 8)}`;
    const rawFileName = `${baseName}_raw.${ext}`;
    const fileName    = `${baseName}.mp4`;
    const thumbName   = `${baseName}_thumb.jpg`;
    const uploadDir   = path.join(process.cwd(), 'public', 'uploads', 'videos', folder);
    const rawPath     = path.join(uploadDir, rawFileName);
    const filePath    = path.join(uploadDir, fileName);
    const thumbPath   = path.join(uploadDir, thumbName);

    await mkdir(uploadDir, { recursive: true });

    // Streamed to disk rather than copied into one Buffer first, so a large
    // video doesn't need a second full copy of itself in the server's memory.
    try {
      await pipeline(
        Readable.fromWeb(file.stream() as unknown as NodeWebReadableStream<Uint8Array>),
        createWriteStream(rawPath),
      );
    } catch (writeError) {
      await unlink(rawPath).catch(() => {});
      throw writeError;
    }

    // Same two checks, with the same messages, as the app's upload
    // (/api/app/upload-video/finalize): the file must be readable, and at most
    // 2 minutes long. Its shape doesn't matter (a landscape video is cropped
    // only if the school chose to), and the steps after this are best-effort.
    let meta: Awaited<ReturnType<typeof probeVideo>>;
    try {
      meta = await probeVideo(rawPath);
    } catch (probeError: any) {
      console.error('probeVideo failed for', rawPath, ':', probeError?.message || probeError);
      await unlink(rawPath).catch(() => {});
      return NextResponse.json({ error: 'Could not read video file. It may be corrupted or in an unsupported format.' }, { status: 400 });
    }

    if (meta.durationSeconds > MAX_VIDEO_SECONDS) {
      await unlink(rawPath).catch(() => {});
      return NextResponse.json({ error: 'Video must be 2 minutes or shorter.' }, { status: 400 });
    }

    await rename(rawPath, filePath);

    // One compression pass (no separate pre-compress, so the picture is never
    // encoded twice):
    //   • up to 10 MB — kept as uploaded (only its index moved to the front if
    //     needed, which doesn't touch the picture);
    //   • over 10 MB — re-encoded to 720p at up to 3 Mbps (H.264, CRF 24),
    //     the same as the app compresses on the phone: looks clean and streams
    //     without buffering. A 2-minute video ends up at most about 45 MB.
    // A crop, if chosen, is applied in the same pass whatever the size. If the
    // re-encode fails or wouldn't make the file smaller, the original is kept.
    const optimisedPath = path.join(uploadDir, `${baseName}_opt.mp4`);
    const optimised = await optimizeForStreaming(filePath, optimisedPath, cropX, {
      compressAboveBytes: COMPRESS_ABOVE_BYTES,
      maxrateKbps: COMPRESS_MAXRATE_KBPS,
    });
    if (optimised === 'remux' || optimised === 'encode') {
      await unlink(filePath).catch(() => {});
      await rename(optimisedPath, filePath);
    }

    let thumbCreated = false;
    try {
      await extractThumbnail(filePath, thumbPath);
      thumbCreated = true;
    } catch {
      // thumbnail generation is best-effort; upload still succeeds without it
    }

    if (s3Enabled()) {
      const keyBase  = `uploads/videos/${folder}`;
      const videoUrl = await uploadFileToS3(filePath, `${keyBase}/${fileName}`, 'video/mp4');
      let thumbnailUrl: string | null = null;
      if (thumbCreated) {
        thumbnailUrl = await uploadFileToS3(thumbPath, `${keyBase}/${thumbName}`, 'image/jpeg');
      }
      await unlink(filePath).catch(() => {});
      if (thumbCreated) await unlink(thumbPath).catch(() => {});
      return NextResponse.json({ videoUrl, thumbnailUrl }, { status: 200 });
    }

    const serverUrl = process.env.SERVER_URL || 'http://localhost:3000';
    const videoUrl  = `${serverUrl}/uploads/videos/${folder}/${fileName}`;
    const thumbnailUrl = thumbCreated
      ? `${serverUrl}/uploads/videos/${folder}/${thumbName}`
      : null;

    return NextResponse.json({ videoUrl, thumbnailUrl }, { status: 200 });
  } catch (error: any) {
    console.error('School upload route error:', error);
    return NextResponse.json({ error: error.message || 'Upload failed' }, { status: 500 });
  }
}
