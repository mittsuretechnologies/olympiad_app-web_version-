import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-guard';
import { searchSubjects } from '@/lib/audit-lookup';
import type { AuditLookupMode } from '@/lib/audit-actions';

export const dynamic = 'force-dynamic';

const SEARCHABLE: AuditLookupMode[] = ['staff', 'student', 'school'];

// GET /api/dashboard/audit-log/lookup?type=staff|student|school&q=…
// Typeahead for the Activity Log's "who / which" field. Only runs once the
// admin has typed 2+ characters, and returns a handful of matches.
export async function GET(request: Request) {
  const { error } = await requireAdmin(request, 'activityLog');
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') as AuditLookupMode | null;
    const q = (searchParams.get('q') || '').trim().slice(0, 80);
    if (!type || !SEARCHABLE.includes(type)) {
      return NextResponse.json({ message: 'Unknown lookup type' }, { status: 400 });
    }
    if (q.length < 2) return NextResponse.json({ results: [] });

    return NextResponse.json({ results: await searchSubjects(type, q) });
  } catch (error) {
    console.error('GET dashboard/audit-log/lookup failed:', error);
    return NextResponse.json({ message: 'Search failed' }, { status: 500 });
  }
}
