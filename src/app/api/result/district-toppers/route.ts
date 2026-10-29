import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-guard';
import { topPerDistrict, DISTRICT_TOP_N } from '@/lib/district-toppers';

export const dynamic = 'force-dynamic';

// GET /api/result/district-toppers — every district's top distinct holistic
// percentages (DISTRICT_TOP_N) and the students on them. Read-only.
export async function GET(request: Request) {
  const { error } = await requireAdmin(request, 'result');
  if (error) return error;
  try {
    return NextResponse.json({ topN: DISTRICT_TOP_N, districts: await topPerDistrict() });
  } catch (err: any) {
    console.error('GET result/district-toppers failed:', err);
    return NextResponse.json({ message: 'Failed to load district toppers' }, { status: 500 });
  }
}
