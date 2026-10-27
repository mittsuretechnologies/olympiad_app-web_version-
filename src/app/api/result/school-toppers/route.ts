import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-guard';
import { topPerSchool, SCHOOL_TOP_N } from '@/lib/school-toppers';

export const dynamic = 'force-dynamic';

// GET /api/result/school-toppers — every school's top distinct holistic
// percentages (SCHOOL_TOP_N) and the students on them. Read-only.
export async function GET(request: Request) {
  const { error } = await requireAdmin(request, 'result');
  if (error) return error;
  try {
    return NextResponse.json({ topN: SCHOOL_TOP_N, schools: await topPerSchool() });
  } catch (err: any) {
    console.error('GET result/school-toppers failed:', err);
    return NextResponse.json({ message: 'Failed to load school toppers' }, { status: 500 });
  }
}
