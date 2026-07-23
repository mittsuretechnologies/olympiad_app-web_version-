// Media (video / thumbnail) URLs are stored in the DB with a hardcoded host that
// depends on where the file was uploaded from — e.g. `http://localhost:3000/...`
// (web) or `http://10.0.2.2:3000/...` (Android emulator alias). Those hosts only
// resolve on a dev machine, so on production the browser/app fails to load them
// (black thumbnails, non-playing videos).
//
// All uploads are served from the same origin under `/uploads/...`, so the safe
// fix is to strip the host and return a root-relative path. The dashboard is
// same-origin, so `/uploads/...` resolves against whatever host is actually
// serving the page (localhost in dev, the public IP/domain in production).

/**
 * Strip a hardcoded `http(s)://host` prefix from a stored media URL, returning a
 * root-relative path (e.g. `/uploads/videos/...`). Returns the value unchanged
 * if it is already relative, and `null` for empty input.
 */
export function toRelativeMedia(url: string | null | undefined): string | null {
  if (!url) return null;
  // Already relative — leave as-is.
  if (url.startsWith('/')) return url;
  // Strip protocol + host, keep the path (and any query/hash).
  const stripped = url.replace(/^https?:\/\/[^/]+/i, '');
  return stripped.startsWith('/') ? stripped : url;
}
