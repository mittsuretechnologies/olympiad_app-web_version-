import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth-guard';
import { MODERATOR_HANDBOOK } from '@/lib/handbook/moderator-handbook';

// Moderator Handbook (internal). Served from here rather than bundled into the
// page so the text is only ever sent to an authenticated moderator.
//
// The handbook takes effect for a moderator on the day they accepted the
// Terms & Conditions at first login (Moderator.termsAcceptedAt), so that date
// fills the "Effective date" on their copy. Until they accept, the source
// placeholder is shown.
export async function GET(request: Request) {
  const { payload, error } = requireRole(request, ['MODERATOR']);
  if (error) return error;

  const moderator = await prisma.moderator.findUnique({
    where: { id: payload.id },
    select: { termsAcceptedAt: true },
  });

  const effectiveDate = moderator?.termsAcceptedAt
    ? moderator.termsAcceptedAt.toLocaleDateString('en-IN', {
        timeZone: 'Asia/Kolkata', day: 'numeric', month: 'long', year: 'numeric',
      })
    : MODERATOR_HANDBOOK.effectiveDate;

  return NextResponse.json(
    { ...MODERATOR_HANDBOOK, effectiveDate },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
