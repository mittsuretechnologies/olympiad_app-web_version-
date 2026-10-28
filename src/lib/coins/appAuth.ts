import { NextResponse } from 'next/server';
import { verify } from 'jsonwebtoken';
import { getJwtSecret } from '@/lib/jwt-secret';

// Auth for /api/app/coins/*: the mobile app's bearer token (role APP_USER).
// Verification is a signature check only — no database hit on the hot path.
export function requireAppUser(request: Request): { userId: string; error?: undefined } | { userId?: undefined; error: NextResponse } {
  const header = request.headers.get('Authorization');
  if (header?.startsWith('Bearer ')) {
    try {
      const decoded = verify(header.slice(7), getJwtSecret()) as { id?: string; role?: string };
      if (decoded.role === 'APP_USER' && decoded.id) return { userId: decoded.id };
    } catch {
      /* fall through */
    }
  }
  return { error: NextResponse.json({ message: 'Unauthorized' }, { status: 401 }) };
}

// Small per-user sliding-window limiter for chatty endpoints (events).
const hits = new Map<string, number[]>();
export function rateLimited(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) { hits.set(key, recent); return true; }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
  return false;
}
