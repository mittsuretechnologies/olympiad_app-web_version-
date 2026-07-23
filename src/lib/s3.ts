import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { readFile } from 'fs/promises';

// S3 media storage. Activated only when the four env vars below are present —
// otherwise every upload route falls back to writing under public/uploads
// exactly as before, so the app runs unchanged until credentials are supplied.
const region          = process.env.S3_REGION || 'ap-south-1';
const bucket          = process.env.S3_BUCKET;
const accessKeyId     = process.env.S3_ACCESS_KEY_ID;
const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;

let client: S3Client | null = null;

export function s3Enabled(): boolean {
  return Boolean(bucket && accessKeyId && secretAccessKey);
}

function getClient(): S3Client {
  if (!client) {
    client = new S3Client({
      region,
      credentials: { accessKeyId: accessKeyId!, secretAccessKey: secretAccessKey! },
    });
  }
  return client;
}

// S3_PUBLIC_URL lets a CDN domain (e.g. CloudFront) replace the raw bucket URL later
// without touching the upload routes.
export function s3PublicUrl(key: string): string {
  const base = process.env.S3_PUBLIC_URL || `https://${bucket}.s3.${region}.amazonaws.com`;
  return `${base}/${key}`;
}

export function videoContentType(ext: string): string {
  const map: Record<string, string> = {
    mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', mkv: 'video/x-matroska',
  };
  return map[ext.toLowerCase()] || 'video/mp4';
}

export function imageContentType(ext: string): string {
  return `image/${ext.toLowerCase() === 'jpg' ? 'jpeg' : ext.toLowerCase()}`;
}

export async function uploadBufferToS3(buffer: Buffer, key: string, contentType: string): Promise<string> {
  await getClient().send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    CacheControl: 'public, max-age=604800',
  }));
  return s3PublicUrl(key);
}

export async function uploadFileToS3(localPath: string, key: string, contentType: string): Promise<string> {
  const body = await readFile(localPath);
  return uploadBufferToS3(body, key, contentType);
}
