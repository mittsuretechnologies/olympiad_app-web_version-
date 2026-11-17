import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { requireAdmin } from '@/lib/auth-guard';
import { getPresignedUploadUrl, s3Enabled, s3PublicUrl, videoContentType } from '@/lib/s3';
import { MITTTV_MEDIA_PREFIX, safeMittTvExt } from '@/lib/mittTv';

export const dynamic = 'force-dynamic';

// POST /api/dashboard/mitttv/upload-url { ext } — step 1 of uploading a MittTV
// video (same flow as Learning & Parenting). With S3 configured it returns a
// short-lived URL the dashboard PUTs the file to directly, so a large video
// never passes through this server. Without S3 (local development), or if the
// browser's PUT fails, the dashboard sends the file to ../upload instead.
export async function POST(request: Request) {
  const { error } = await requireAdmin(request, 'mittTv');
  if (error) return error;
  if (!s3Enabled()) return NextResponse.json({ mode: 'server' });
  try {
    const { ext } = await request.json().catch(() => ({ ext: 'mp4' }));
    const safeExt = safeMittTvExt(ext);
    if (!safeExt) return NextResponse.json({ message: 'Video must be MP4, MOV, M4V or WebM' }, { status: 400 });
    const key = `${MITTTV_MEDIA_PREFIX}${Date.now()}_${randomUUID().slice(0, 8)}.${safeExt}`;
    const contentType = videoContentType(safeExt);
    const uploadUrl = await getPresignedUploadUrl(key, contentType, 60 * 60);
    return NextResponse.json({ mode: 's3', uploadUrl, contentType, videoUrl: s3PublicUrl(key) });
  } catch (e: any) {
    console.error('MittTV presign error:', e);
    return NextResponse.json({ message: e.message || 'Could not create upload URL' }, { status: 500 });
  }
}
