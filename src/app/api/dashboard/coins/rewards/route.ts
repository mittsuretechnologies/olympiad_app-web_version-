import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { rewardSchema, rewardData } from '@/lib/coins/adminSchemas';
import { auditCoins, bad, coinsAdmin, serverError, zodMessage } from '@/lib/coins/adminApi';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { error } = await coinsAdmin(request);
  if (error) return error;
  try {
    const [rewards, unused, redeemed] = await Promise.all([
      prisma.coinReward.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }] }),
      prisma.coinRewardCode.groupBy({ by: ['rewardId'], where: { redemptionId: null }, _count: true }),
      prisma.coinRedemption.groupBy({ by: ['rewardId'], where: { status: { not: 'CANCELLED' } }, _count: true }),
    ]);
    const left = new Map(unused.map((u) => [u.rewardId, u._count]));
    const used = new Map(redeemed.map((u) => [u.rewardId, u._count]));
    return NextResponse.json({
      rewards: rewards.map((r) => ({ ...r, codesLeft: left.get(r.id) ?? 0, redeemedCount: used.get(r.id) ?? 0 })),
    });
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(request: Request) {
  const { payload, error } = await coinsAdmin(request);
  if (error) return error;
  try {
    const parsed = rewardSchema.safeParse(await request.json());
    if (!parsed.success) return bad(zodMessage(parsed.error));
    const reward = await prisma.coinReward.create({ data: rewardData(parsed.data) });
    await auditCoins(payload, 'COIN_CONFIG_CHANGED', 'CoinReward', reward.id, { next: reward });
    return NextResponse.json({ reward }, { status: 201 });
  } catch (e) {
    return serverError(e);
  }
}
