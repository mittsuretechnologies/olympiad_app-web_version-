import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { CoinError } from '@/lib/coins/ledger';
import { cancelRedemption } from '@/lib/coins/rewards';
import { auditCoins, bad, coinsAdmin, serverError, zodMessage } from '@/lib/coins/adminApi';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  action: z.enum(['FULFIL', 'CANCEL']),
  note: z.string().trim().max(300).nullish(),
  // Delivery details for the user to see (a gift-card code, a receipt link …).
  code: z.string().trim().max(300).nullish(),
});

// FULFIL marks a manual reward as delivered; CANCEL refunds the coins.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { payload, error } = await coinsAdmin(request);
  if (error) return error;
  try {
    const { id } = await params;
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) return bad(zodMessage(parsed.error));
    const { action, note, code } = parsed.data;

    if (action === 'CANCEL') {
      await cancelRedemption(id, note || null);
    } else {
      const r = await prisma.coinRedemption.updateMany({
        where: { id, status: 'PENDING' },
        data: { status: 'FULFILLED', adminNote: note || null, ...(code ? { code } : {}) },
      });
      if (r.count !== 1) return bad('Only pending redemptions can be fulfilled.', 409);
    }
    await auditCoins(payload, 'COIN_REDEMPTION_HANDLED', 'CoinRedemption', id, { next: { action } , reason: note });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof CoinError) return bad(e.message, e.status);
    return serverError(e);
  }
}
