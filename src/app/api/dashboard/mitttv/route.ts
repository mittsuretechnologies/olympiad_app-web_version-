import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-guard';
import { loadSettings, saveSettings } from '@/lib/mittTv';
import { adminSnapshot } from '@/lib/mittTvAdmin';
import { cleanSettings } from '@/lib/mittTvShared';

export const dynamic = 'force-dynamic';

// GET /api/dashboard/mitttv — everything the MittTV page shows: settings, the
// screen's rows (with their videos) and every video (with short-lived signed
// preview links, since the bucket is private).
export async function GET(request: Request) {
  const { error } = await requireAdmin(request, 'mittTv');
  if (error) return error;
  try {
    return NextResponse.json(await adminSnapshot());
  } catch (e: any) {
    console.error('mitttv admin load error:', e);
    return NextResponse.json({ message: e.message || 'Could not load MittTV' }, { status: 500 });
  }
}

// PATCH /api/dashboard/mitttv — settings: { enabled, audiences, buttonLabel, screenTitle } (any subset).
export async function PATCH(request: Request) {
  const { error } = await requireAdmin(request, 'mittTv');
  if (error) return error;
  try {
    const body = await request.json().catch(() => ({}));
    const next = cleanSettings(body, await loadSettings());
    if (typeof next === 'string') return NextResponse.json({ message: next }, { status: 400 });
    return NextResponse.json({ settings: await saveSettings(next) });
  } catch (e: any) {
    return NextResponse.json({ message: e.message || 'Could not save' }, { status: 500 });
  }
}
