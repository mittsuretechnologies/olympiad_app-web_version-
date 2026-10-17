import { NextResponse } from 'next/server';
import { verify } from 'jsonwebtoken';
import { writeFile, mkdir, unlink, stat, rename } from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import { probeVideo, compressVideo } from '@/lib/videoProbe';
import { prisma } from '@/lib/prisma';
import { s3Enabled, uploadFileToS3 } from '@/lib/s3';
import { optimizeForStreaming } from '@/lib/videoOptimize';
import { getJwtSecret } from '@/lib/jwt-secret';
import { MAX_VIDEO_SECONDS } from '@/lib/uploadRules';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ffmpegPath: string = require('ffmpeg-static');

const JWT_SECRET      = getJwtSecret();
const MAX_BYTES       = 150 * 1024 * 1024; // 150 MB — above this, auto-compress (no hard upper cap)

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

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(rawPath, buffer);

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

    let workingPath = rawPath;

    // ── Compress if over the soft size limit ──────────────────────────────────
    // Needs the duration to pick a bitrate; without it the streaming pass below
    // still lightens the file.
    const { size: workingSize } = await stat(workingPath);
    if (meta.durationSeconds > 0 && workingSize > MAX_BYTES) {
      const targetBitrateKbps = Math.max(
        800,
        Math.floor((MAX_BYTES * 8) / meta.durationSeconds / 1000 * 0.9) // 10% headroom under target
      );
      const compressedPath = path.join(uploadDir, `${baseName}_compressed.mp4`);
      try {
        await compressVideo(workingPath, compressedPath, targetBitrateKbps);
        await unlink(workingPath).catch(() => {});
        workingPath = compressedPath;
      } catch (err) {
        // Upload the original rather than refuse it.
        console.error('compressVideo failed, keeping the original:', err);
        await unlink(compressedPath).catch(() => {});
      }
    }

    // Move the final working file into place as the canonical fileName
    if (workingPath !== filePath) {
      await rename(workingPath, filePath);
    }

    // Make it light enough for a phone to stream (about 720p / 2.5 Mbps), and
    // apply the crop if one was chosen, in one pass. An already-light video is
    // left alone; a failure keeps the file as is.
    const optimisedPath = path.join(uploadDir, `${baseName}_opt.mp4`);
    const optimised = await optimizeForStreaming(filePath, optimisedPath, cropX);
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
