import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { CoinError, creditOnce } from '@/lib/coins/ledger';
import { auditCoins, bad, coinsAdmin, serverError, zodMessage } from '@/lib/coins/adminApi';

export const dynamic = 'force-dynamic';

// One user's wallet, recent ledger and a reconciliation check (balance must
// equal the sum of the ledger).
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await coinsAdmin(request);
  if (error) return error;
  try {
    const { id } = await params;
    const [wallet, ledger, sum] = await Promise.all([
      prisma.coinWallet.findUnique({
        where: { appUserId: id },
        include: { appUser: { select: { userId: true, mobile: true, email: true } } },
      }),
      prisma.coinTransaction.findMany({ where: { appUserId: id }, orderBy: { createdAt: 'desc' }, take: 100 }),
      prisma.coinTransaction.aggregate({ where: { appUserId: id }, _sum: { amount: true } }),
    ]);
    if (!wallet) return bad('This user has no wallet yet.', 404);
    const ledgerSum = sum._sum.amount ?? 0;
    return NextResponse.json({ wallet, ledger, ledgerSum, reconciled: ledgerSum === wallet.balance });
  } catch (e) {
    return serverError(e);
  }
}

const adjustSchema = z.object({
  amount: z.number().int().refine((n) => n !== 0, 'amount cannot be 0').refine((n) => Math.abs(n) <= 1_000_000, 'too large'),
  reason: z.string().trim().min(3).max(200),
});

// Manual correction (+ or −). A reason is mandatory and goes into both the
// ledger and the audit log.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { payload, error } = await coinsAdmin(request);
  if (error) return error;
  try {
    const { id } = await params;
    const parsed = adjustSchema.safeParse(await request.json());
    if (!parsed.success) return bad(zodMessage(parsed.error));
    const { amount, reason } = parsed.data;
    const res = await creditOnce({
      appUserId: id,
      amount,
      type: 'ADMIN_ADJUST',
      key: `admin:${id}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
      sourceType: 'admin',
      sourceId: payload.id,
      note: reason,
    });
    await auditCoins(payload, 'COIN_ADJUSTED', 'CoinWallet', id, { next: { amount, balance: res.balance }, reason });
    return NextResponse.json({ balance: res.balance });
  } catch (e) {
    if (e instanceof CoinError) return bad(e.message, e.status);
    return serverError(e);
  }
}
