import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { getCoinConfig } from './config';
import { applyCoins, assertCoinsOn, CoinError, coinTransaction, ensureWallet, lockWallet } from './ledger';

// Reward catalogue and redemption. Redeeming is one transaction: check limits →
// claim a coupon code (or a unit of stock) → take the coins → write the
// redemption. If any step fails nothing is spent.

function inWindow(r: { startsAt: Date | null; endsAt: Date | null }, now = new Date()) {
  return (!r.startsAt || r.startsAt <= now) && (!r.endsAt || r.endsAt > now);
}

export async function listRewardsForUser(appUserId: string) {
  const cfg = await assertCoinsOn('rewards');
  const now = new Date();
  const rewards = (await prisma.coinReward.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: 'asc' }, { costCoins: 'asc' }],
  })).filter((r) => inWindow(r, now));
  if (!rewards.length) return { rewards: [], inrPerCoin: cfg.inrPerCoin, minBalance: cfg.redeem.minBalance };

  const ids = rewards.map((r) => r.id);
  const [codeStock, mine] = await Promise.all([
    prisma.coinRewardCode.groupBy({ by: ['rewardId'], where: { rewardId: { in: ids }, redemptionId: null }, _count: true }),
    prisma.coinRedemption.groupBy({ by: ['rewardId'], where: { appUserId, rewardId: { in: ids }, status: { not: 'CANCELLED' } }, _count: true }),
  ]);
  const stockOf = new Map(codeStock.map((c) => [c.rewardId, c._count]));
  const usedOf = new Map(mine.map((c) => [c.rewardId, c._count]));

  return {
    inrPerCoin: cfg.inrPerCoin,
    minBalance: cfg.redeem.minBalance,
    rewards: rewards.map((r) => {
      const left = r.kind === 'COUPON' ? stockOf.get(r.id) ?? 0 : r.stock;       // null = unlimited
      const used = usedOf.get(r.id) ?? 0;
      return {
        id: r.id,
        title: r.title,
        description: r.description,
        imageUrl: r.imageUrl,
        kind: r.kind,
        costCoins: r.costCoins,
        terms: r.terms,
        instructions: r.instructions,
        soldOut: left !== null && left <= 0,
        limitReached: r.perUserLimit > 0 && used >= r.perUserLimit,
        endsAt: r.endsAt ? r.endsAt.toISOString() : null,
      };
    }),
  };
}

export async function redeemReward(appUserId: string, rewardId: string) {
  const cfg = await assertCoinsOn('rewards');
  await ensureWallet(appUserId);
  const redemptionId = randomUUID();

  return coinTransaction(
    async (tx) => {
      const w = await lockWallet(tx, appUserId);
      const reward = await tx.coinReward.findUnique({ where: { id: rewardId } });
      if (!reward || !reward.active || !inWindow(reward)) throw new CoinError('NO_REWARD', 'This reward is no longer available.', 404);
      if (w.balance < cfg.redeem.minBalance) {
        throw new CoinError('MIN_BALANCE', `You need at least ${cfg.redeem.minBalance} coins before you can redeem.`, 409);
      }
      if (w.balance < reward.costCoins) throw new CoinError('INSUFFICIENT', "You don't have enough coins for this reward yet.", 409);
      if (reward.perUserLimit > 0) {
        const used = await tx.coinRedemption.count({ where: { appUserId, rewardId, status: { not: 'CANCELLED' } } });
        if (used >= reward.perUserLimit) throw new CoinError('LIMIT', "You've already claimed the maximum for this reward.", 409);
      }

      let code: string | null = null;
      if (reward.kind === 'COUPON') {
        // SKIP LOCKED: simultaneous redeemers each get a different code instead of queueing.
        const got = await tx.$queryRaw<{ code: string }[]>`
          UPDATE "public"."CoinRewardCode" SET "redemptionId" = ${redemptionId}
           WHERE "id" = (SELECT "id" FROM "public"."CoinRewardCode"
                          WHERE "rewardId" = ${rewardId} AND "redemptionId" IS NULL
                          ORDER BY "createdAt" LIMIT 1 FOR UPDATE SKIP LOCKED)
       RETURNING "code"`;
        if (!got[0]) throw new CoinError('SOLD_OUT', 'Sorry, this reward just ran out.', 409);
        code = got[0].code;
      } else if (reward.stock !== null) {
        const dec = await tx.coinReward.updateMany({ where: { id: rewardId, stock: { gt: 0 } }, data: { stock: { decrement: 1 } } });
        if (dec.count !== 1) throw new CoinError('SOLD_OUT', 'Sorry, this reward just ran out.', 409);
      }

      const { balance } = await applyCoins(tx, {
        appUserId,
        amount: -reward.costCoins,
        type: 'REDEEM',
        key: `redeem:${redemptionId}`,
        sourceType: 'reward',
        sourceId: rewardId,
        note: reward.title,
      });
      const red = await tx.coinRedemption.create({
        data: {
          id: redemptionId,
          appUserId,
          rewardId,
          coinsSpent: reward.costCoins,
          status: reward.kind === 'COUPON' ? 'FULFILLED' : 'PENDING',
          code,
        },
      });
      return { id: red.id, status: red.status, code, title: reward.title, instructions: reward.instructions, balance };
    },
    async () => { throw new CoinError('RETRY', 'Please try again.', 409); },
  );
}

export async function redemptionsForUser(appUserId: string) {
  const rows = await prisma.coinRedemption.findMany({
    where: { appUserId },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true, status: true, code: true, coinsSpent: true, createdAt: true, adminNote: true,
      reward: { select: { title: true, imageUrl: true, instructions: true, terms: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    status: r.status,
    code: r.status === 'CANCELLED' ? null : r.code,
    coinsSpent: r.coinsSpent,
    createdAt: r.createdAt.toISOString(),
    note: r.adminNote,
    title: r.reward.title,
    imageUrl: r.reward.imageUrl,
    instructions: r.reward.instructions,
    terms: r.reward.terms,
  }));
}

// Admin: cancel a PENDING redemption, give the coins back, return the stock.
export async function cancelRedemption(redemptionId: string, note: string | null) {
  const red = await prisma.coinRedemption.findUnique({ where: { id: redemptionId }, include: { reward: true } });
  if (!red) throw new CoinError('NOT_FOUND', 'Redemption not found.', 404);
  if (red.status !== 'PENDING') throw new CoinError('BAD_STATE', 'Only pending redemptions can be cancelled.', 409);
  await ensureWallet(red.appUserId);

  return coinTransaction(
    async (tx) => {
      await lockWallet(tx, red.appUserId);
      const flip = await tx.coinRedemption.updateMany({
        where: { id: redemptionId, status: 'PENDING' },
        data: { status: 'CANCELLED', adminNote: note },
      });
      if (flip.count !== 1) throw new CoinError('BAD_STATE', 'Already handled.', 409);
      if (red.reward.kind === 'MANUAL' && red.reward.stock !== null) {
        await tx.coinReward.update({ where: { id: red.rewardId }, data: { stock: { increment: 1 } } });
      }
      await applyCoins(tx, {
        appUserId: red.appUserId, amount: red.coinsSpent, type: 'REFUND',
        key: `refund:${redemptionId}`, sourceType: 'reward', sourceId: red.rewardId, note: `Refund: ${red.reward.title}`,
      });
    },
    async () => undefined,
  );
}
