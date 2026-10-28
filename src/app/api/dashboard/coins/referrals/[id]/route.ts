import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { payReferral } from '@/lib/coins/referral';
import { auditCoins, bad, coinsAdmin, serverError, zodMessage } from '@/lib/coins/adminApi';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({ action: z.enum(['APPROVE', 'REJECT']), reason: z.string().trim().max(200).nullish() });

// APPROVE pays a referral that was blocked (e.g. a family sharing one phone) or
// is still waiting; REJECT closes a pending one without paying.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { payload, error } = await coinsAdmin(request);
  if (error) return error;
  try {
    const { id } = await params;
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) return bad(zodMessage(parsed.error));
    const ref = await prisma.referral.findUnique({ where: { id }, select: { id: true, refereeId: true, status: true } });
    if (!ref) return bad('Referral not found', 404);

    if (parsed.data.action === 'APPROVE') {
      if (ref.status === 'REWARDED') return bad('Already paid.', 409);
      if (!(await payReferral(ref.refereeId, true))) return bad('Could not pay this referral.', 409);
    } else {
      const r = await prisma.referral.updateMany({
        where: { id, status: 'PENDING' },
        data: { status: 'REJECTED', rejectReason: parsed.data.reason || 'ADMIN' },
      });
      if (r.count !== 1) return bad('Only pending referrals can be rejected.', 409);
    }
    await auditCoins(payload, 'COIN_REFERRAL_REVIEWED', 'Referral', id, { next: { action: parsed.data.action }, reason: parsed.data.reason });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
