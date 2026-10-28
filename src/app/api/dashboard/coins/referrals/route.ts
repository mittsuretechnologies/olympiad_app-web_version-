import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { coinsAdmin, serverError } from '@/lib/coins/adminApi';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { error } = await coinsAdmin(request);
  if (error) return error;
  try {
    const status = new URL(request.url).searchParams.get('status');
    const [rows, counts, top] = await Promise.all([
      prisma.referral.findMany({
        where: status ? { status } : undefined,
        orderBy: { createdAt: 'desc' },
        take: 200,
        select: {
          id: true, status: true, rejectReason: true, deviceId: true, createdAt: true, rewardedAt: true,
          referrerCoins: true, refereeCoins: true,
          referrer: { select: { userId: true, mobile: true } },
          referee: { select: { userId: true, mobile: true } },
        },
      }),
      prisma.referral.groupBy({ by: ['status'], _count: true }),
      prisma.referral.groupBy({
        by: ['referrerId'], where: { status: 'REWARDED' }, _count: true, orderBy: { _count: { referrerId: 'desc' } }, take: 10,
      }),
    ]);
    const users = await prisma.appUser.findMany({
      where: { id: { in: top.map((t) => t.referrerId) } },
      select: { id: true, userId: true },
    });
    const name = new Map(users.map((u) => [u.id, u.userId]));
    return NextResponse.json({
      referrals: rows,
      counts: Object.fromEntries(counts.map((c) => [c.status, c._count])),
      leaderboard: top.map((t) => ({ userId: name.get(t.referrerId) ?? '—', rewarded: t._count })),
    });
  } catch (e) {
    return serverError(e);
  }
}
