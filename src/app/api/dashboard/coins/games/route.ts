import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { bandsSchema } from '@/lib/coins/games';
import { auditCoins, bad, coinsAdmin, serverError, zodMessage } from '@/lib/coins/adminApi';

export const dynamic = 'force-dynamic';

const ruleSchema = z.object({
  gameKey: z.string().trim().regex(/^[a-z0-9_-]{2,40}$/, 'lowercase letters, numbers, - or _'),
  title: z.string().trim().min(1).max(60),
  active: z.boolean(),
  maxPlaysPerDay: z.number().int().min(1).max(1000),
  maxCoinsPerDay: z.number().int().min(0).max(1_000_000),
  minSeconds: z.number().int().min(0).max(3600),
  bands: bandsSchema,
});

export async function GET(request: Request) {
  const { error } = await coinsAdmin(request);
  if (error) return error;
  try {
    return NextResponse.json({ games: await prisma.coinGameRule.findMany({ orderBy: { gameKey: 'asc' } }) });
  } catch (e) {
    return serverError(e);
  }
}

// Create or update one game's rules, keyed by gameKey (the id the game itself reports).
export async function PUT(request: Request) {
  const { payload, error } = await coinsAdmin(request);
  if (error) return error;
  try {
    const parsed = ruleSchema.safeParse(await request.json());
    if (!parsed.success) return bad(zodMessage(parsed.error));
    const d = parsed.data;
    const previous = await prisma.coinGameRule.findUnique({ where: { gameKey: d.gameKey } });
    const game = await prisma.coinGameRule.upsert({ where: { gameKey: d.gameKey }, create: d, update: d });
    await auditCoins(payload, 'COIN_CONFIG_CHANGED', 'CoinGameRule', d.gameKey, { previous, next: game });
    return NextResponse.json({ game });
  } catch (e) {
    return serverError(e);
  }
}

export async function DELETE(request: Request) {
  const { payload, error } = await coinsAdmin(request);
  if (error) return error;
  try {
    const gameKey = new URL(request.url).searchParams.get('gameKey');
    if (!gameKey) return bad('gameKey is required');
    const previous = await prisma.coinGameRule.findUnique({ where: { gameKey } });
    if (!previous) return bad('Game not found', 404);
    await prisma.coinGameRule.delete({ where: { gameKey } });
    await auditCoins(payload, 'COIN_CONFIG_CHANGED', 'CoinGameRule', gameKey, { previous });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
