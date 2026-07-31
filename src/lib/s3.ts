import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { readFile } from 'fs/promises';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import type { Readable } from 'stream';

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

// Lets the client PUT the file straight to S3, bypassing our server for the actual
// bytes — the upload no longer has to pass through the EC2 instance at all.
export async function getPresignedUploadUrl(key: string, contentType: string, expiresInSeconds = 300): Promise<string> {
  const command = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType });
  return getSignedUrl(getClient(), command, { expiresIn: expiresInSeconds });
}

// Cleanup for presigned uploads that fail validation after the client already sent
// the bytes straight to S3 (e.g. video too long) — otherwise they'd sit in the bucket forever.
export async function deleteFromS3(key: string): Promise<void> {
  await getClient().send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

// ffmpeg-static's Linux binary segfaults when given an https:// URL as -i input
// (confirmed against this bucket — crashes ~1s in, before printing any stream info).
// So finalize pulls the object back down to local disk first and runs ffmpeg on that,
// same as the original server-mediated route did. EC2-to-S3 in the same region is fast
// enough that this doesn't reintroduce the upload bottleneck the presigned flow fixed.
export async function downloadFromS3(key: string, localPath: string): Promise<void> {
  const { Body } = await getClient().send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  await pipeline(Body as Readable, createWriteStream(localPath));
}
