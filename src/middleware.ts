import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// CORS for /api/* used to be a static "Allow-Origin: *" + "Allow-Credentials: true"
// header in next.config.ts, which let any third-party site read API responses
// cross-origin. Auth here uses Authorization: Bearer tokens, not cookies, so
// credentials aren't needed at all; origin is restricted to an explicit
// allow-list (comma-separated ALLOWED_ORIGINS env var).
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const CORS_METHODS = 'GET,DELETE,PATCH,POST,PUT,OPTIONS';
const CORS_HEADERS =
  'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization';

export function middleware(request: NextRequest) {
  const origin = request.headers.get('origin') || '';
  const isAllowed = allowedOrigins.includes(origin);

  if (request.method === 'OPTIONS') {
    const preflight = new NextResponse(null, { status: isAllowed ? 204 : 403 });
    if (isAllowed) {
      preflight.headers.set('Access-Control-Allow-Origin', origin);
      preflight.headers.set('Vary', 'Origin');
      preflight.headers.set('Access-Control-Allow-Methods', CORS_METHODS);
      preflight.headers.set('Access-Control-Allow-Headers', CORS_HEADERS);
    }
    return preflight;
  }

  const response = NextResponse.next();
  if (isAllowed) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Vary', 'Origin');
    response.headers.set('Access-Control-Allow-Methods', CORS_METHODS);
    response.headers.set('Access-Control-Allow-Headers', CORS_HEADERS);
  }
  return response;
}

export const config = {
  // Everything under /api except the dashboard's Learning & Parenting video
  // upload: Next buffers the body of every request middleware runs on (and
  // cuts it off at middlewareClientMaxBodySize), and that upload has no size
  // limit. It's a same-origin dashboard call, so it needs no CORS headers.
  // Also skips the development-only local-put video upload (see lib/localUploads.ts),
  // which streams a whole video and must not be cut off at the body-size limit.
  // Same for the school portal's and the student's multipart video uploads
  // (school/me/upload-video, student/upload-video): a video over the limit
  // arrives truncated and request.formData() fails with "Failed to parse body
  // as FormData". The school portal calls it same-origin; the app sends no
  // Origin, so neither needs CORS headers.
  matcher: '/api/((?!dashboard/home-videos/upload(?:/|$)|app/upload-video/local-put(?:/|$)|school/me/upload-video(?:/|$)|student/upload-video(?:/|$)).*)',
};
