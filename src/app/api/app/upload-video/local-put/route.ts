import { NextResponse } from 'next/server';
import { verify } from 'jsonwebtoken';
import { mkdir } from 'fs/promises';
import { createWriteStream } from 'fs';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import path from 'path';
import { getJwtSecret } from '@/lib/jwt-secret';
import { isSafeKey, localPathForKey, localUploadsAllowed } from '@/lib/localUploads';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// PUT /api/app/upload-video/local-put?token=...
// Local-development stand-in for the S3 presigned PUT (see lib/localUploads.ts).
// The token is the one /presign signed; it names the single key this request
// may write, so it is the only authorisation needed. Never available in production.
export async function PUT(request: Request) {
  if (!localUploadsAllowed()) {
    return NextResponse.json({ error: 'Not available' }, { status: 404 });
  }

  const token = new URL(request.url).searchParams.get('token') || '';
  let claims: any;
  try {
    claims = verify(token, getJwtSecret());
  } catch {
    return NextResponse.json({ error: 'Invalid or expired upload link' }, { status: 401 });
  }
  const key = claims?.key;
  if (claims?.purpose !== 'local-put' || typeof key !== 'string' || !isSafeKey(key)
      || !key.startsWith(`uploads/app-videos/${claims.uid}/`)) {
    return NextResponse.json({ error: 'Invalid upload link' }, { status: 403 });
  }
  if (!request.body) {
    return NextResponse.json({ error: 'No file received' }, { status: 400 });
  }

  try {
    const dest = localPathForKey(key);
    await mkdir(path.dirname(dest), { recursive: true });
    // Streamed to disk, so a large video is never held in memory.
    await pipeline(Readable.fromWeb(request.body as any), createWriteStream(dest));
    return new NextResponse(null, { status: 200 });
  } catch (err) {
    console.error('local-put failed:', err);
    return NextResponse.json({ error: 'Could not store the upload' }, { status: 500 });
  }
}
