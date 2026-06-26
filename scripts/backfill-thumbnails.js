// One-off backfill: generate thumbnails for existing videos that have no thumbnailUrl.
// Usage: node scripts/backfill-thumbnails.js
const { PrismaClient } = require('@prisma/client');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const ffmpegPath = require('ffmpeg-static');

const prisma = new PrismaClient();
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';

function urlToLocalPath(videoUrl) {
  try {
    const u = new URL(videoUrl);
    if (!u.pathname.startsWith('/uploads/')) return null;
    return path.join(process.cwd(), 'public', u.pathname);
  } catch {
    return null;
  }
}

function extractThumbnail(videoPath, thumbPath) {
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
    proc.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited with code ${code}`))));
    proc.on('error', reject);
  });
}

async function main() {
  const videos = await prisma.video.findMany({
    where: { thumbnailUrl: null },
    select: { id: true, videoUrl: true },
  });

  console.log(`Found ${videos.length} videos without a thumbnail.`);

  let success = 0, skipped = 0, failed = 0;

  for (const v of videos) {
    const videoPath = urlToLocalPath(v.videoUrl);
    if (!videoPath || !fs.existsSync(videoPath)) {
      console.log(`SKIP  ${v.id} — local file not found (${v.videoUrl})`);
      skipped++;
      continue;
    }

    const dir = path.dirname(videoPath);
    const base = path.basename(videoPath, path.extname(videoPath));
    const thumbName = `${base}_thumb.jpg`;
    const thumbPath = path.join(dir, thumbName);

    try {
      await extractThumbnail(videoPath, thumbPath);
      const relUrl = videoPath
        .substring(path.join(process.cwd(), 'public').length)
        .split(path.sep)
        .join('/');
      const thumbRelUrl = relUrl.replace(/\/[^/]+$/, `/${thumbName}`);
      const thumbnailUrl = `${SERVER_URL}${thumbRelUrl}`;

      await prisma.video.update({ where: { id: v.id }, data: { thumbnailUrl } });
      console.log(`OK    ${v.id} — ${thumbnailUrl}`);
      success++;
    } catch (err) {
      console.log(`FAIL  ${v.id} — ${err.message}`);
      failed++;
    }
  }

  console.log(`\nDone. success=${success} skipped=${skipped} failed=${failed}`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
