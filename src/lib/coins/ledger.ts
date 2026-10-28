import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCoinConfig } from './config';
import { istDateKey, istDayStart } from './time';

// The only code allowed to change a balance. Every credit/debit:
//   • runs inside a transaction that holds the user's wallet row lock, so two
//     taps / two devices can never both pass the same check;
//   • carries an idempotency key — repeating a request changes nothing;
//   • refuses to take a balance below zero;
//   • leaves one CoinTransaction row behind (the audit trail).

export type Tx = Prisma.TransactionClient;

export class CoinError extends Error {
  constructor(public code: string, message: string, public status = 400) {
    super(message);
  }
}

export function coinErrorResponse(e: unknown) {
  if (e instanceof CoinError) {
    return NextResponse.json({ message: e.message, code: e.code }, { status: e.status });
  }
  console.error('[coins]', e);
  return NextResponse.json({ message: 'Something went wrong. Please try again.' }, { status: 500 });
}

// The master switch, checked first by every app endpoint.
export async function assertCoinsOn(feature?: 'checkin' | 'tasks' | 'referral' | 'rewards' | 'games') {
  const cfg = await getCoinConfig();
  if (!cfg.enabled || (feature && !cfg.features[feature])) {
    throw new CoinError('DISABLED', 'This feature is not available right now.', 403);
  }
  return cfg;
}

export interface WalletRow {
  id: string;
  appUserId: string;
  balance: number;
  lifetimeEarned: number;
  lifetimeSpent: number;
  currentStreak: number;
  longestStreak: number;
  cycleDay: number;
  cyclesCompleted: number;
  lastCheckinDate: string | null;
}

// The wallet, created on first use. Only ordinary app accounts get one.
export async function ensureWallet(appUserId: string): Promise<WalletRow> {
  const found = await prisma.coinWallet.findUnique({ where: { appUserId } });
  if (found) return found;
  const user = await prisma.appUser.findUnique({
    where: { id: appUserId },
    select: { accountType: true, deletionRequestedAt: true },
  });
  if (!user) throw new CoinError('NO_USER', 'Account not found.', 404);
  if (user.accountType !== 'USER') throw new CoinError('NOT_ELIGIBLE', 'Coins are not available for this account.', 403);
  return prisma.coinWallet.upsert({ where: { appUserId }, create: { appUserId }, update: {} });
}

// Locks the wallet row until the surrounding transaction ends. Callers must
// have run ensureWallet first.
export async function lockWallet(tx: Tx, appUserId: string): Promise<WalletRow> {
  const rows = await tx.$queryRaw<WalletRow[]>`
    SELECT * FROM "public"."CoinWalletV2" WHERE "appUserId" = ${appUserId} FOR UPDATE`;
  if (!rows[0]) throw new CoinError('NO_WALLET', 'Wallet not found.', 404);
  return rows[0];
}

export interface ApplyInput {
  appUserId: string;
  amount: number;                 // + credit, − debit
  type: string;
  key: string;                    // idempotency key
  sourceType?: string;
  sourceId?: string;
  note?: string;
  meta?: Prisma.InputJsonValue;
}

// Applies one ledger entry. `applied: false` means this key was used before —
// nothing changed and `balance` is what that earlier entry left.
export async function applyCoins(tx: Tx, input: ApplyInput): Promise<{ applied: boolean; balance: number }> {
  const { appUserId, amount, type, key } = input;
  if (!Number.isInteger(amount) || amount === 0) throw new CoinError('BAD_AMOUNT', 'Invalid coin amount.', 400);

  const existing = await tx.coinTransaction.findUnique({ where: { idempotencyKey: key }, select: { balanceAfter: true } });
  if (existing) return { applied: false, balance: existing.balanceAfter };

  // What this entry does to the lifetime counters.
  let earned = 0;
  let spent = 0;
  if (type === 'REFUND') spent = -amount;
  else if (type === 'REDEEM') spent = -amount;
  else earned = amount;

  // Single atomic statement: refuses to go below zero, returns the new balance.
  const rows = await tx.$queryRaw<{ balance: number }[]>`
    UPDATE "public"."CoinWalletV2"
       SET "balance" = "balance" + ${amount}::int,
           "lifetimeEarned" = "lifetimeEarned" + ${earned}::int,
           "lifetimeSpent" = "lifetimeSpent" + ${spent}::int,
           "updatedAt" = now()
     WHERE "appUserId" = ${appUserId} AND "balance" + ${amount}::int >= 0
 RETURNING "balance"`;
  if (!rows[0]) throw new CoinError('INSUFFICIENT', "You don't have enough coins for this.", 409);

  const cfg = await getCoinConfig();
  await tx.coinTransaction.create({
    data: {
      appUserId,
      amount,
      type,
      sourceType: input.sourceType ?? null,
      sourceId: input.sourceId ?? null,
      idempotencyKey: key,
      balanceAfter: rows[0].balance,
      inrPerCoin: cfg.inrPerCoin,
      note: input.note ?? null,
      meta: input.meta ?? undefined,
    },
  });
  return { applied: true, balance: rows[0].balance };
}

// Runs fn in a transaction. A duplicate-key race (two identical requests at the
// same instant) is not an error: the loser gets onDuplicate().
export async function coinTransaction<T>(fn: (tx: Tx) => Promise<T>, onDuplicate: () => Promise<T>): Promise<T> {
  try {
    return await prisma.$transaction(fn, { maxWait: 5000, timeout: 10000 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return onDuplicate();
    throw e;
  }
}

// Types that count towards the daily earn cap.
const CAPPED_TYPES = ['TASK', 'GAME'];

// How many more coins this user may earn today from tasks + games (Infinity = no cap).
export async function dailyCapRemaining(tx: Tx, appUserId: string): Promise<number> {
  const { caps } = await getCoinConfig();
  if (!caps.dailyEarnCoins) return Infinity;
  const agg = await tx.coinTransaction.aggregate({
    where: { appUserId, type: { in: CAPPED_TYPES }, createdAt: { gte: istDayStart(istDateKey()) } },
    _sum: { amount: true },
  });
  return Math.max(0, caps.dailyEarnCoins - (agg._sum.amount ?? 0));
}

// Credits one user outside any caller transaction (referral payouts, admin).
export async function creditOnce(input: ApplyInput): Promise<{ applied: boolean; balance: number }> {
  await ensureWallet(input.appUserId);
  return coinTransaction(
    async (tx) => {
      await lockWallet(tx, input.appUserId);
      return applyCoins(tx, input);
    },
    async () => ({ applied: false, balance: (await ensureWallet(input.appUserId)).balance }),
  );
}
