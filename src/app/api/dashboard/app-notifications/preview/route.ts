import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-guard';
import { ANNOUNCEMENT_TYPES, cleanFilters, resolveRecipients } from '@/lib/appAnnouncements';

export const dynamic = 'force-dynamic';

// POST { filters } -> how many the filters reach, per type, before sending.
export async function POST(request: Request) {
  const { error } = await requireAdmin(request, 'appNotifications');
  if (error) return error;
  try {
    const body = await request.json().catch(() => ({}));
    const filters = cleanFilters(body?.filters);
    if (typeof filters === 'string') {
      return NextResponse.json({ total: 0, byType: {}, webSchools: 0, message: filters });
    }
    const r = await resolveRecipients(filters);
    const byType = Object.fromEntries(ANNOUNCEMENT_TYPES.map((t) => [t.key, filters.types.includes(t.key) ? r.byType[t.key].length : 0]));
    return NextResponse.json({ total: r.appUserIds.length, byType, webSchools: r.schoolIds.length });
  } catch (e: any) {
    console.error('POST /api/dashboard/app-notifications/preview failed:', e);
    return NextResponse.json({ message: e.message }, { status: 500 });
  }
}
