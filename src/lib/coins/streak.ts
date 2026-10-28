import { prisma } from '@/lib/prisma';
import { memo } from './memo';
import { getCoinConfig } from './config';
import { applyCoins, assertCoinsOn, CoinError, coinTransaction, ensureWallet, lockWallet, type WalletRow } from './ledger';
import { daysBetween, istDateKey } from './time';
import { evaluateReferral } from './referral';
import { recordCoinEvent } from './tasks';

export interface LadderDay { day: number; coins: number; isBonus: boolean; label: string | null }

export function getStreakLadder(): Promise<LadderDay[]> {
  return memo('ladder', () => prisma.coinStreakDay.findMany({ orderBy: { day: 'asc' } }));
}

export async function cycleLength(ladder?: LadderDay[]): Promise<number> {
  const l = ladder ?? (await getStreakLadder());
  if (l.length) return l[l.length - 1].day;
  return (await getCoinConfig()).streak.fallbackCycle;
}

export function coinsForDay(ladder: LadderDay[], day: number, fallback: number): LadderDay {
  return ladder.find((d) => d.day === day) ?? { day, coins: fallback, isBonus: false, label: null };
}

export interface StreakStatus {
  checkedInToday: boolean;
  // false once the streak has lapsed: the next check-in starts again at day 1.
  alive: boolean;
  currentStreak: number;
  longestStreak: number;
  // Day of the ladder the user is on (when checkedInToday) or about to collect.
  cycleDay: number;
  nextDay: number;
  cycleLength: number;
  cyclesCompleted: number;
}

// Pure: works the streak out from the wallet and today's date.
export function streakStatus(w: WalletRow, len: number, graceDays: number, today = istDateKey()): StreakStatus {
  const last = w.lastCheckinDate;
  const gap = last ? daysBetween(last, today) : null;
  const checkedInToday = gap === 0;
  const alive = gap !== null && gap >= 0 && gap - 1 <= graceDays;
  let nextDay = 1;
  if (alive && !checkedInToday && w.cycleDay < len) nextDay = w.cycleDay + 1;
  return {
    checkedInToday,
    alive,
    currentStreak: alive ? w.currentStreak : 0,
    longestStreak: w.longestStreak,
    cycleDay: alive ? w.cycleDay : 0,
    nextDay: checkedInToday ? w.cycleDay : nextDay,
    cycleLength: len,
    cyclesCompleted: w.cyclesCompleted,
  };
}

export interface CheckinResult {
  coins: number;
  isBonus: boolean;
  label: string | null;
  streak: number;
  cycleDay: number;
  cycleCompleted: boolean;
  balance: number;
}

export async function performCheckin(appUserId: string): Promise<CheckinResult> {
  const cfg = await assertCoinsOn('checkin');
  await ensureWallet(appUserId);
  const ladder = await getStreakLadder();
  const len = await cycleLength(ladder);
  const today = istDateKey();

  const result = await coinTransaction(
    async (tx) => {
      const w = await lockWallet(tx, appUserId);
      if (w.lastCheckinDate === today) throw new CoinError('ALREADY_COLLECTED', "You've already collected today's coins.", 409);

      const gap = w.lastCheckinDate ? daysBetween(w.lastCheckinDate, today) : null;
      const continues = gap !== null && gap >= 1 && gap - 1 <= cfg.streak.graceDays;

      let cycleDay = 1;
      let streak = 1;
      let cycles = w.cyclesCompleted;
      if (continues) {
        streak = w.currentStreak + 1;
        if (w.cycleDay >= len) cycles += 1;       // finished the ladder yesterday: start over
        else cycleDay = w.cycleDay + 1;
      }
      const day = coinsForDay(ladder, cycleDay, cfg.streak.fallbackCoins);

      await tx.coinCheckin.create({ data: { appUserId, dateKey: today, cycleDay, streak, coins: day.coins } });
      let balance = w.balance;
      if (day.coins > 0) {
        balance = (await applyCoins(tx, {
          appUserId,
          amount: day.coins,
          type: 'CHECKIN',
          key: `checkin:${appUserId}:${today}`,
          sourceType: 'checkin',
          sourceId: today,
          meta: { cycleDay, streak },
        })).balance;
      }
      await tx.coinWallet.update({
        where: { appUserId },
        data: {
          currentStreak: streak,
          longestStreak: Math.max(w.longestStreak, streak),
          cycleDay,
          cyclesCompleted: cycles,
          lastCheckinDate: today,
        },
      });
      return {
        coins: day.coins,
        isBonus: day.isBonus,
        label: day.label,
        streak,
        cycleDay,
        cycleCompleted: cycleDay >= len,
        balance,
      };
    },
    async () => {
      throw new CoinError('ALREADY_COLLECTED', "You've already collected today's coins.", 409);
    },
  );

  // Side effects never delay or fail the check-in itself.
  void evaluateReferral(appUserId, { type: 'CHECKIN' }).catch((e) => console.error('[coins] referral', e));
  void recordCoinEvent(appUserId, 'OPEN_APP').catch((e) => console.error('[coins] event', e));
  return result;
}
