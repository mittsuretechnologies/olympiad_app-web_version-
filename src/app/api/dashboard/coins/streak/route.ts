import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { auditCoins, bad, coinsAdmin, serverError, zodMessage } from '@/lib/coins/adminApi';

export const dynamic = 'force-dynamic';

const ladderSchema = z.object({
  days: z.array(z.object({
    coins: z.number().int().min(0).max(100000),
    isBonus: z.boolean().default(false),
    label: z.string().trim().max(40).nullish(),
  })).max(365),
});

export async function GET(request: Request) {
  const { error } = await coinsAdmin(request);
  if (error) return error;
  try {
    return NextResponse.json({ days: await prisma.coinStreakDay.findMany({ orderBy: { day: 'asc' } }) });
  } catch (e) {
    return serverError(e);
  }
}

// The ladder is saved whole: row N of the array is day N, so there can never be
// a gap or a duplicate day.
export async function PUT(request: Request) {
  const { payload, error } = await coinsAdmin(request);
  if (error) return error;
  try {
    const parsed = ladderSchema.safeParse(await request.json());
    if (!parsed.success) return bad(zodMessage(parsed.error));
    const previous = await prisma.coinStreakDay.findMany({ orderBy: { day: 'asc' } });
    const rows = parsed.data.days.map((d, i) => ({ day: i + 1, coins: d.coins, isBonus: d.isBonus, label: d.label || null }));
    await prisma.$transaction([prisma.coinStreakDay.deleteMany({}), prisma.coinStreakDay.createMany({ data: rows })]);
    await auditCoins(payload, 'COIN_CONFIG_CHANGED', 'CoinStreakDay', 'ladder', { previous, next: rows });
    return NextResponse.json({ days: rows });
  } catch (e) {
    return serverError(e);
  }
}
