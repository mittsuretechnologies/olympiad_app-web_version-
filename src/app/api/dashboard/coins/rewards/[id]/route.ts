import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { rewardSchema, rewardData } from '@/lib/coins/adminSchemas';
import { auditCoins, bad, coinsAdmin, serverError, zodMessage } from '@/lib/coins/adminApi';

export const dynamic = 'force-dynamic';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { payload, error } = await coinsAdmin(request);
  if (error) return error;
  try {
    const { id } = await params;
    const parsed = rewardSchema.safeParse(await request.json());
    if (!parsed.success) return bad(zodMessage(parsed.error));
    const previous = await prisma.coinReward.findUnique({ where: { id } });
    if (!previous) return bad('Reward not found', 404);
    const reward = await prisma.coinReward.update({ where: { id }, data: rewardData(parsed.data) });
    await auditCoins(payload, 'COIN_CONFIG_CHANGED', 'CoinReward', id, { previous, next: reward });
    return NextResponse.json({ reward });
  } catch (e) {
    return serverError(e);
  }
}

// A reward people already redeemed can't be deleted (their history points at
// it) — switch it off instead.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { payload, error } = await coinsAdmin(request);
  if (error) return error;
  try {
    const { id } = await params;
    const previous = await prisma.coinReward.findUnique({ where: { id } });
    if (!previous) return bad('Reward not found', 404);
    if (await prisma.coinRedemption.count({ where: { rewardId: id } })) {
      return bad('This reward has been redeemed before, so it can only be switched off, not deleted.', 409);
    }
    await prisma.coinReward.delete({ where: { id } });
    await auditCoins(payload, 'COIN_CONFIG_CHANGED', 'CoinReward', id, { previous });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
