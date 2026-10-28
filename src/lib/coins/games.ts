import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { memo } from './memo';
import {
  applyCoins, assertCoinsOn, CoinError, coinTransaction, dailyCapRemaining, ensureWallet, lockWallet,
} from './ledger';
import { istDateKey, istDayStart } from './time';
import { recordCoinEvent } from './tasks';

// Games report a finished round; the server decides the coins from the
// admin-set score bands and caps. The app never says "give me N coins".
// A score reported by a phone can in principle be faked, which is why every
// game has per-day play and coin caps (and why the shared daily cap applies).

export const bandsSchema = z.array(z.object({
  minScore: z.number().int().min(0),
  coins: z.number().int().min(0).max(100000),
})).min(1).max(20);

export function gameRules() {
  return memo('games', () => prisma.coinGameRule.findMany({ where: { active: true } }));
}

export async function submitGameResult(args: {
  appUserId: string; gameKey: string; score: number; sessionId: string; durationSeconds: number;
}) {
  await assertCoinsOn('games');
  const rule = (await gameRules()).find((g) => g.gameKey === args.gameKey);
  if (!rule) throw new CoinError('NO_GAME', 'This game does not give coins.', 404);
  if (args.durationSeconds < rule.minSeconds) return { coins: 0, reason: 'TOO_SHORT' as const };

  const bands = bandsSchema.safeParse(rule.bands);
  const band = bands.success
    ? [...bands.data].sort((a, b) => b.minScore - a.minScore).find((b) => args.score >= b.minScore)
    : undefined;
  if (!band || band.coins <= 0) return { coins: 0, reason: 'NO_REWARD' as const };

  await ensureWallet(args.appUserId);
  const key = `game:${args.appUserId}:${args.gameKey}:${args.sessionId}`;
  const since = istDayStart(istDateKey());

  const out = await coinTransaction<{ coins: number; reason: string; balance?: number }>(
    async (tx) => {
      await lockWallet(tx, args.appUserId);
      const todays = await tx.coinTransaction.aggregate({
        where: { appUserId: args.appUserId, type: 'GAME', sourceType: args.gameKey, createdAt: { gte: since } },
        _count: true,
        _sum: { amount: true },
      });
      if (todays._count >= rule.maxPlaysPerDay) return { coins: 0, reason: 'PLAY_LIMIT' as const };
      const room = Math.min(rule.maxCoinsPerDay - (todays._sum.amount ?? 0), await dailyCapRemaining(tx, args.appUserId));
      const coins = Math.min(band.coins, room);
      if (coins <= 0) return { coins: 0, reason: 'DAILY_CAP' as const };

      const r = await applyCoins(tx, {
        appUserId: args.appUserId, amount: coins, type: 'GAME', key,
        sourceType: args.gameKey, sourceId: args.sessionId, note: rule.title, meta: { score: args.score },
      });
      return { coins: r.applied ? coins : 0, balance: r.balance, reason: r.applied ? ('OK' as const) : ('DUPLICATE' as const) };
    },
    async () => ({ coins: 0, reason: 'DUPLICATE' as const }),
  );

  void recordCoinEvent(args.appUserId, 'PLAY_GAME').catch(() => {});
  return out;
}
