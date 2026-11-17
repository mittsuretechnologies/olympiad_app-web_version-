import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth-guard';
import { MODERATOR_HANDBOOK, type Handbook } from '@/lib/handbook/moderator-handbook';
import { EVALUATOR_HANDBOOK } from '@/lib/handbook/evaluator-handbook';

// Staff handbooks (internal). Served from here rather than bundled into a page
// so the text is only ever sent to an authenticated staff member of that role:
//   MODERATOR -> Moderator Handbook
//   EVALUATOR -> Evaluator's Handbook (also Part C of the first-login Terms
//                gate, which loads it from here before the evaluator accepts)
//
// The Moderator Handbook takes effect for a moderator on the day they accepted
// the Terms at first login (Moderator.termsAcceptedAt), so that date fills the
// "Effective date" on their copy; until they accept, the source placeholder is
// shown. The Evaluator's Handbook shows no effective date.

const formatDate = (d: Date) => d.toLocaleDateString('en-IN', {
  timeZone: 'Asia/Kolkata', day: 'numeric', month: 'long', year: 'numeric',
});

export async function GET(request: Request) {
  const { payload, error } = requireRole(request, ['MODERATOR', 'EVALUATOR']);
  if (error) return error;

  let handbook: Handbook;
  if (payload.role === 'EVALUATOR') {
    handbook = EVALUATOR_HANDBOOK;
  } else {
    const moderator = await prisma.moderator.findUnique({
      where: { id: payload.id },
      select: { termsAccepted: true, termsAcceptedAt: true },
    });
    handbook = {
      ...MODERATOR_HANDBOOK,
      effectiveDate: moderator?.termsAcceptedAt ? formatDate(moderator.termsAcceptedAt) : MODERATOR_HANDBOOK.effectiveDate,
    };
  }

  return NextResponse.json(
    { ...handbook, role: payload.role },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
