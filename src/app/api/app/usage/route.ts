import { NextResponse } from 'next/server';
import { verify } from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getJwtSecret } from '@/lib/jwt-secret';

// POST /api/app/usage — app usage sessions from the mobile app
// (Components/utils/usageTracker.js), for Reports → User Activity.
//
// Batched: up to 50 sessions per request. The answer lists `accepted`
// session ids and the phone deletes exactly those; anything else stays
// queued and is sent again later. Resends are harmless — (deviceId,
// sessionId) is unique, so a session already stored is simply accepted
// again. A session that can never be valid (bad dates, impossible duration)
// is also listed as accepted, so the phone drops it instead of retrying it
// forever — it just isn't stored.
//
// Login is optional (guests are tracked by device only); with a valid app
// token the sessions are attributed to that account.

const MAX_SESSION_SECONDS = 24 * 60 * 60;
const MAX_AGE_MS = 31 * 24 * 60 * 60 * 1000;

const sessionSchema = z.object({
  sessionId: z.string().trim().min(1).max(64),
  startedAt: z.string(),
  endedAt: z.string(),
  activeSeconds: z.number().int().min(0),
  idleSeconds: z.number().int().min(0),
  endReason: z.string().trim().max(20),
});

const bodySchema = z.object({
  deviceId: z.string().trim().min(1).max(100),
  platform: z.string().trim().max(20).default('unknown'),
  appVersion: z.string().trim().max(40).nullable().optional(),
  sentAt: z.string().optional(),
  sessions: z.array(z.unknown()).max(50),
});

const END_REASONS = new Set(['background', 'recovered', 'logout', 'login']);

function appUserIdFrom(request: Request): string | null {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  try {
    const decoded = verify(auth.slice(7), getJwtSecret()) as { role?: string; id?: string };
    return decoded.role === 'APP_USER' && decoded.id ? decoded.id : null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  let raw: unknown;
  try { raw = await request.json(); } catch {
    return NextResponse.json({ message: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ message: 'Invalid payload' }, { status: 400 });
  }
  const { deviceId, platform, appVersion, sessions } = parsed.data;
  const appUserId = appUserIdFrom(request);
  const now = Date.now();

  const accepted: string[] = [];
  const rows: {
    deviceId: string; sessionId: string; appUserId: string | null; platform: string; appVersion: string | null;
    startedAt: Date; endedAt: Date; activeSeconds: number; idleSeconds: number; endReason: string;
  }[] = [];

  for (const item of sessions) {
    const s = sessionSchema.safeParse(item);
    if (!s.success) continue;                       // no usable id → nothing to confirm
    const v = s.data;
    accepted.push(v.sessionId);                     // confirmed either way (see top)
    const startedAt = new Date(v.startedAt);
    const endedAt = new Date(v.endedAt);
    const total = v.activeSeconds + v.idleSeconds;
    if (Number.isNaN(startedAt.getTime()) || Number.isNaN(endedAt.getTime())) continue;
    if (endedAt < startedAt || total <= 0 || total > MAX_SESSION_SECONDS) continue;
    if (startedAt.getTime() > now + 60 * 60 * 1000 || startedAt.getTime() < now - MAX_AGE_MS) continue;
    rows.push({
      deviceId,
      sessionId: v.sessionId,
      appUserId,
      platform: platform.toLowerCase(),
      appVersion: appVersion ?? null,
      startedAt,
      endedAt,
      activeSeconds: v.activeSeconds,
      idleSeconds: v.idleSeconds,
      endReason: END_REASONS.has(v.endReason) ? v.endReason : 'background',
    });
  }

  try {
    if (rows.length) await prisma.appUsageSession.createMany({ data: rows, skipDuplicates: true });
  } catch (e) {
    // Not stored → nothing confirmed, the phone keeps them and retries.
    console.error('POST /api/app/usage failed:', e);
    return NextResponse.json({ message: 'Could not save usage' }, { status: 500 });
  }

  return NextResponse.json({ accepted });
}
