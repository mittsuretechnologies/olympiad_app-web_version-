import { NextResponse } from 'next/server';
import { requireAppUser, rateLimited } from '@/lib/coins/appAuth';
import { getCoinConfig } from '@/lib/coins/config';
import { recordCoinEvent } from '@/lib/coins/tasks';

export const dynamic = 'force-dynamic';

// The app reports things only it can see (a share, an app open). Only event
// types the admin allowed under Settings → clientEvents are accepted; the rest
// (likes, uploads …) are counted by the server itself.
export async function POST(request: Request) {
  const { userId, error } = requireAppUser(request);
  if (error) return error;
  if (rateLimited(`ev:${userId}`, 30, 60_000)) return NextResponse.json({ ok: true });
  try {
    const body = await request.json().catch(() => ({}));
    const type = typeof body?.type === 'string' ? body.type : '';
    const cfg = await getCoinConfig();
    if (!cfg.clientEvents.includes(type as never)) return NextResponse.json({ message: 'Unknown event' }, { status: 400 });
    await recordCoinEvent(userId, type);
    return NextResponse.json({ ok: true });
  } catch {
    // Progress is best-effort; never surface this to the user.
    return NextResponse.json({ ok: true });
  }
}
