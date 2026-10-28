import { getCoinConfig } from './config';
import { ensureWallet } from './ledger';
import { cycleLength, getStreakLadder, streakStatus } from './streak';
import { tasksForUser } from './tasks';
import { gameRules } from './games';
import { ensureReferralCode } from './referral';

// Everything the Coins screen and the home-screen chip need, in one request:
// settings and the ladder come from memory, the wallet and task progress are
// the only two database reads.
export async function coinSummary(appUserId: string) {
  const cfg = await getCoinConfig();
  if (!cfg.enabled) return { enabled: false as const };

  const [wallet, ladder, tasks, games] = await Promise.all([
    ensureWallet(appUserId),
    getStreakLadder(),
    cfg.features.tasks ? tasksForUser(appUserId) : Promise.resolve([]),
    cfg.features.games ? gameRules() : Promise.resolve([]),
  ]);
  // Everyone gets an invite code the first time the app loads coins, so a friend
  // can use it even before its owner has opened Invite & Earn. Cached in memory,
  // so this costs a query only once per user per server start.
  if (cfg.features.referral) void ensureReferralCode(appUserId).catch(() => {});
  const len = await cycleLength(ladder);
  const streak = streakStatus(wallet, len, cfg.streak.graceDays);

  const days = Array.from({ length: len }, (_, i) => {
    const day = i + 1;
    const row = ladder.find((d) => d.day === day);
    return { day, coins: row?.coins ?? cfg.streak.fallbackCoins, isBonus: row?.isBonus ?? false, label: row?.label ?? null };
  });

  return {
    enabled: true as const,
    inrPerCoin: cfg.inrPerCoin,
    features: cfg.features,
    balance: wallet.balance,
    lifetimeEarned: wallet.lifetimeEarned,
    streak,
    days,
    tasks,
    games: games.map((g) => ({ gameKey: g.gameKey, title: g.title, maxPlaysPerDay: g.maxPlaysPerDay })),
    serverTime: new Date().toISOString(),
  };
}
