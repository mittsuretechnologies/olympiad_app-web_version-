import path from 'path';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { s3Enabled, uploadBufferToS3, getS3ObjectBuffer } from '@/lib/s3';

// Proof documents in infringement notices are legal/personal records, so they
// never go under public/uploads: S3 (private bucket) when configured, else a
// directory outside the web root. Only the SuperAdmin file route reads them.

export interface StoredNoticeFile {
  name: string;
  kind: 'ownership' | 'authority';
  contentType: string;
  size: number;
  storage: 's3' | 'local';
  key: string;
}

const localRoot = () => process.env.PRIVATE_UPLOADS_DIR || path.join(process.cwd(), 'private-uploads');

export async function storeNoticeFile(
  referenceId: string,
  file: { filename: string; content: Buffer; contentType: string },
  kind: StoredNoticeFile['kind'],
): Promise<StoredNoticeFile> {
  const key = `private/infringement-notices/${referenceId}/${file.filename}`;
  const base = { name: file.filename, kind, contentType: file.contentType, size: file.content.length };

  if (s3Enabled()) {
    await uploadBufferToS3(file.content, key, file.contentType);
    return { ...base, storage: 's3', key };
  }

  const fullPath = path.join(localRoot(), key);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, file.content);
  return { ...base, storage: 'local', key };
}

export async function readNoticeFile(file: StoredNoticeFile): Promise<Buffer> {
  if (file.storage === 's3') return getS3ObjectBuffer(file.key);
  const root = path.resolve(localRoot());
  const fullPath = path.resolve(root, file.key);
  if (!fullPath.startsWith(root + path.sep)) throw new Error('Invalid file path');
  return readFile(fullPath);
}
