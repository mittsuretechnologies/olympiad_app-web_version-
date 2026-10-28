import { NextResponse } from 'next/server';
import { requireAppUser, rateLimited } from '@/lib/coins/appAuth';
import { coinErrorResponse } from '@/lib/coins/ledger';
import { submitGameResult } from '@/lib/coins/games';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const { userId, error } = requireAppUser(request);
  if (error) return error;
  if (rateLimited(`game:${userId}`, 20, 60_000)) return NextResponse.json({ message: 'Slow down a little.' }, { status: 429 });
  try {
    const b = await request.json().catch(() => ({}));
    const score = Number(b?.score);
    const duration = Number(b?.durationSeconds ?? 0);
    const bad =
      typeof b?.gameKey !== 'string' || typeof b?.sessionId !== 'string' ||
      b.sessionId.length < 8 || b.sessionId.length > 80 ||
      !Number.isFinite(score) || score < 0 || score > 1e9 ||
      !Number.isFinite(duration) || duration < 0;
    if (bad) return NextResponse.json({ message: 'Invalid game result' }, { status: 400 });
    return NextResponse.json(await submitGameResult({
      appUserId: userId, gameKey: b.gameKey, sessionId: b.sessionId,
      score: Math.floor(score), durationSeconds: Math.floor(duration),
    }));
  } catch (e) {
    return coinErrorResponse(e);
  }
}
