import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-guard';
import { getResultOverview, type ExamSource } from '@/lib/result-overview';
import { normaliseQuery, schoolMatchesQuery, studentMatchesQuery } from '@/lib/resultSearch';

export const dynamic = 'force-dynamic';

// GET /api/result/overview
//   (no schoolId)  every student — heavy; only the CSV export uses this.
//   ?schoolId=CODE one school's students only (what the Result page loads when a
//                  school is opened): its students, videos and exam results,
//                  optionally narrowed by q (school-or-student search) and status.
export async function GET(request: Request) {
  const { error } = await requireAdmin(request, 'result');
  if (error) return error;
  try {
    const url = new URL(request.url);
    const examSource: ExamSource = url.searchParams.get('examSource') === 'ai' ? 'ai' : 'manual';
    const schoolCode = (url.searchParams.get('schoolId') || '').trim();
    const q = normaliseQuery(url.searchParams.get('q'));
    const statusParam = url.searchParams.get('status') === 'Complete' || url.searchParams.get('status') === 'Incomplete'
      ? url.searchParams.get('status')! : '';

    const overview = await getResultOverview(schoolCode, examSource);
    if (!overview) return NextResponse.json([]);
    const { scopeSchool, rows: result } = overview;

    // Opened-school request: the same search/status rules the school list used.
    if (scopeSchool) {
      const schoolHit = schoolMatchesQuery(q, scopeSchool);
      const out = result.filter(r =>
        (schoolHit || studentMatchesQuery(q, { name: r.name, code: r.olympiadCode })) &&
        (!statusParam || r.status === statusParam));
      return NextResponse.json(out);
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('GET result/overview failed:', error);
    return NextResponse.json({ message: 'Failed to fetch results', error: error?.message }, { status: 500 });
  }
}
