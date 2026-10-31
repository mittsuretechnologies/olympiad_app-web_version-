import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-guard';
import { rankStateRound, STATE_TOP_N, NATIONAL_TOP_N, STATE_VIDEO_MARKS } from '@/lib/state-round';

export const dynamic = 'force-dynamic';

// GET /api/result/state-round — everyone forwarded to the state level with their
// state-round score, the national pool and the national winners. Read-only.
export async function GET(request: Request) {
  const { error } = await requireAdmin(request, 'result');
  if (error) return error;
  try {
    return NextResponse.json({ stateTopN: STATE_TOP_N, nationalTopN: NATIONAL_TOP_N, videoMarks: STATE_VIDEO_MARKS, ...(await rankStateRound()) });
  } catch (err: any) {
    console.error('GET result/state-round failed:', err);
    return NextResponse.json({ message: 'Failed to load the state round' }, { status: 500 });
  }
}
