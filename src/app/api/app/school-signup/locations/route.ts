import { NextResponse } from 'next/server';
import { STATES } from '@/lib/locations';

export const dynamic = 'force-dynamic';

// GET /api/app/school-signup/locations            -> { states: string[] }
// GET /api/app/school-signup/locations?state=Name -> { districts: string[] }
// The full India list (not only states that already have an Olympiad school):
// a General School can be anywhere.
export async function GET(request: Request) {
  const state = new URL(request.url).searchParams.get('state')?.trim();
  if (!state) {
    return NextResponse.json({ states: STATES.map(s => s.name) });
  }
  const found = STATES.find(s => s.name.toLowerCase() === state.toLowerCase());
  if (!found) return NextResponse.json({ message: 'Unknown state' }, { status: 404 });
  return NextResponse.json({ districts: found.districts.map(d => d.name) });
}
