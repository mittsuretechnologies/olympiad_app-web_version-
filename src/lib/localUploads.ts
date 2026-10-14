import path from 'path';

/**
 * Local-development fallback for the app's direct-to-S3 video upload.
 *
 * The app uploads in three steps (presign -> PUT -> finalize). Without S3
 * credentials in .env those routes had nothing to talk to, so no video could be
 * uploaded on a developer machine. With the fallback, "presign" hands out a URL
 * on this same server, "local-put" writes the bytes under public/uploads, and
 * "finalize" validates and thumbnails the file in place.
 *
 * Switched on only when S3 is NOT configured AND the server is not running in
 * production: a production server without a bucket must keep failing loudly.
 */
export function localUploadsAllowed(): boolean {
  return process.env.NODE_ENV !== 'production';
}

/** Absolute path of a stored key under public/ (keys look like "uploads/app-videos/<id>/<file>"). */
export function localPathForKey(key: string): string {
  return path.join(process.cwd(), 'public', key);
}

/**
 * URL the media will be served from. Uses SERVER_URL, same as the older
 * server-side upload route's local fallback. On an Android emulator,
 * "localhost" is the emulator itself, so run `adb reverse tcp:3000 tcp:3000`
 * to let it reach this server at the same address.
 */
export function localMediaUrl(key: string): string {
  const base = (process.env.SERVER_URL || 'http://localhost:3000').replace(/\/+$/, '');
  return `${base}/${key}`;
}

/** A key is safe to touch on disk only if it has no path tricks. */
export function isSafeKey(key: string): boolean {
  return /^uploads\/app-videos\/[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/.test(key) && !key.includes('..');
}
