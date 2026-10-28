import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { auditCoins, bad, coinsAdmin, serverError, zodMessage } from '@/lib/coins/adminApi';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({ codes: z.array(z.string().trim().min(1).max(120)).min(1).max(20000) });

// The pool: unused codes first, then ones already handed out (with who got them).
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await coinsAdmin(request);
  if (error) return error;
  try {
    const { id } = await params;
    const rows = await prisma.coinRewardCode.findMany({
      where: { rewardId: id },
      orderBy: [{ redemptionId: { sort: 'asc', nulls: 'first' } }, { createdAt: 'asc' }],
      take: 1000,
      select: { id: true, code: true, redemptionId: true, createdAt: true },
    });
    return NextResponse.json({
      codes: rows.map((r) => ({ id: r.id, code: r.code, used: r.redemptionId !== null, createdAt: r.createdAt })),
    });
  } catch (e) {
    return serverError(e);
  }
}

// Add coupon codes to a reward's pool (paste or CSV, one per line). Duplicates
// — within the upload or against codes already in the pool — are skipped.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { payload, error } = await coinsAdmin(request);
  if (error) return error;
  try {
    const { id } = await params;
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) return bad(zodMessage(parsed.error));
    const reward = await prisma.coinReward.findUnique({ where: { id }, select: { id: true, kind: true, title: true } });
    if (!reward) return bad('Reward not found', 404);
    if (reward.kind !== 'COUPON') return bad('Only coupon rewards use a code pool.');

    const unique = [...new Set(parsed.data.codes)];
    const added = await prisma.coinRewardCode.createMany({
      data: unique.map((code) => ({ rewardId: id, code })),
      skipDuplicates: true,
    });
    await auditCoins(payload, 'COIN_CONFIG_CHANGED', 'CoinRewardCode', id, {
      next: { reward: reward.title, uploaded: parsed.data.codes.length, added: added.count },
    });
    return NextResponse.json({ added: added.count, skipped: parsed.data.codes.length - added.count });
  } catch (e) {
    return serverError(e);
  }
}

// Remove one unused code (?codeId=…), or every unused code when none is given.
// Handed-out codes stay, they belong to redemptions.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { payload, error } = await coinsAdmin(request);
  if (error) return error;
  try {
    const { id } = await params;
    const codeId = new URL(request.url).searchParams.get('codeId');
    const r = await prisma.coinRewardCode.deleteMany({ where: { rewardId: id, redemptionId: null, ...(codeId ? { id: codeId } : {}) } });
    await auditCoins(payload, 'COIN_CONFIG_CHANGED', 'CoinRewardCode', id, { next: { removedUnused: r.count } });
    return NextResponse.json({ removed: r.count });
  } catch (e) {
    return serverError(e);
  }
}
