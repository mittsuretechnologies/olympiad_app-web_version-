import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { requireRole } from '@/lib/auth-guard';
import { getPresignedUploadUrl, s3Enabled, s3PublicUrl, videoContentType } from '@/lib/s3';
import { safeVideoExt } from '@/lib/homeSectionVideos';

export const dynamic = 'force-dynamic';

// POST /api/dashboard/home-videos/upload-url — step 1 of uploading a video.
// With S3 configured, returns a short-lived URL the dashboard PUTs the file to
// directly, so a large video never passes through this server. Without S3
// (local development) — or if the browser's direct PUT fails, e.g. the bucket
// has no CORS rule for the dashboard's origin — the dashboard falls back to
// POSTing the file to ./upload instead.
export async function POST(request: Request) {
  const { error } = requireRole(request, ['SUPERADMIN']);
  if (error) return error;

  if (!s3Enabled()) return NextResponse.json({ mode: 'server' });

  try {
    const { ext } = await request.json().catch(() => ({ ext: 'mp4' }));
    const safeExt = safeVideoExt(ext);
    if (!safeExt) return NextResponse.json({ message: 'Video must be MP4, MOV, M4V or WebM' }, { status: 400 });

    const key = `uploads/home-videos/${Date.now()}_${randomUUID().slice(0, 8)}.${safeExt}`;
    const contentType = videoContentType(safeExt);
    const uploadUrl = await getPresignedUploadUrl(key, contentType, 30 * 60);

    return NextResponse.json({ mode: 's3', uploadUrl, contentType, videoUrl: s3PublicUrl(key) });
  } catch (e: any) {
    console.error('Home video presign error:', e);
    return NextResponse.json({ message: e.message || 'Could not create upload URL' }, { status: 500 });
  }
}
