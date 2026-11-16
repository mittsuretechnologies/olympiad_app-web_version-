import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCoinConfig } from '@/lib/coins/config';
import { coinsAdmin, serverError } from '@/lib/coins/adminApi';

export const dynamic = 'force-dynamic';

// Headline numbers for the Overview tab. Liability = coins people hold but have
// not spent yet, converted at the current ₹-per-coin rate.
export async function GET(request: Request) {
  const { error } = await coinsAdmin(request);
  if (error) return error;
  try {
    const since = new Date(Date.now() - 30 * 86_400_000);
    const [cfg, wallets, byType, pending, pendingRef] = await Promise.all([
      getCoinConfig(),
      prisma.coinWallet.aggregate({ _sum: { balance: true, balanceInr: true, lifetimeEarned: true, lifetimeSpent: true }, _count: true }),
      prisma.coinTransaction.groupBy({ by: ['type'], where: { createdAt: { gte: since } }, _sum: { amount: true, amountInr: true }, _count: true }),
      prisma.coinRedemption.count({ where: { status: 'PENDING' } }),
      prisma.referral.count({ where: { status: 'PENDING' } }),
    ]);
    const outstanding = wallets._sum.balance ?? 0;
    return NextResponse.json({
      inrPerCoin: cfg.inrPerCoin,
      wallets: wallets._count,
      outstandingCoins: outstanding,
      // Each coin at the rate it was earned at (CoinWallet.balanceInr).
      liabilityInr: Math.round((wallets._sum.balanceInr ?? 0) * 100) / 100,
      lifetimeEarned: wallets._sum.lifetimeEarned ?? 0,
      lifetimeSpent: wallets._sum.lifetimeSpent ?? 0,
      last30Days: byType.map((t) => ({ type: t.type, coins: t._sum.amount ?? 0, inr: t._sum.amountInr ?? 0, count: t._count })),
      pendingRedemptions: pending,
      pendingReferrals: pendingRef,
    });
  } catch (e) {
    return serverError(e);
  }
}
