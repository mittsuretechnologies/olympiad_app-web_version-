import { NextResponse } from 'next/server';
import { verify } from 'jsonwebtoken';
import { getPresignedUploadUrl, s3PublicUrl, s3Enabled, videoContentType } from '@/lib/s3';
import { getJwtSecret } from '@/lib/auth-guard';

const JWT_SECRET = getJwtSecret();

function getAppUserFromToken(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  try {
    const decoded = verify(token, JWT_SECRET) as any;
    if (decoded.role !== 'APP_USER') return null;
    return decoded;
  } catch {
    return null;
  }
}

// POST /api/app/upload-video/presign — step 1 of the direct-to-S3 upload.
// Returns a short-lived URL the client PUTs the raw video bytes to directly,
// so the file never has to pass through this server.
export async function POST(request: Request) {
  const appUser = getAppUserFromToken(request);
  if (!appUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!s3Enabled()) {
    return NextResponse.json({ error: 'Direct upload is not configured on this server.' }, { status: 500 });
  }

  try {
    const { ext } = await request.json().catch(() => ({ ext: 'mp4' }));
    const safeExt = /^[a-z0-9]{2,5}$/i.test(ext) ? ext.toLowerCase() : 'mp4';

    const fileName = `${Date.now()}_${appUser.id.slice(0, 8)}.${safeExt}`;
    const key = `uploads/app-videos/${appUser.id}/${fileName}`;
    const contentType = videoContentType(safeExt);

    const uploadUrl = await getPresignedUploadUrl(key, contentType);

    return NextResponse.json({ uploadUrl, key, contentType, videoUrl: s3PublicUrl(key) }, { status: 200 });
  } catch (error: any) {
    console.error('Presign error:', error);
    return NextResponse.json({ error: error.message || 'Could not create upload URL' }, { status: 500 });
  }
}
