import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { memo, invalidateCoinCache } from './memo';

// Every global coin knob, edited from Dashboard → Coins → Settings. Stored as
// one JSON blob in AppSetting so adding a knob never needs a migration; every
// field has a default, so an empty or older blob still parses.

export const EVENT_TYPES = [
  'OPEN_APP', 'WATCH_VIDEO', 'LIKE_VIDEO', 'FOLLOW', 'UPLOAD_VIDEO', 'SHARE', 'PLAY_GAME', 'CUSTOM',
] as const;
export type CoinEventType = (typeof EVENT_TYPES)[number];

const int = (min: number, max: number, def: number) => z.number().int().min(min).max(max).default(def);

export const coinConfigSchema = z.object({
  // Master switch: off hides coins everywhere in the app and refuses every API call.
  enabled: z.boolean().default(true),
  features: z.object({
    checkin:  z.boolean().default(true),
    tasks:    z.boolean().default(true),
    referral: z.boolean().default(true),
    rewards:  z.boolean().default(true),
    games:    z.boolean().default(true),
  }).default({}),
  // Rupee value of one coin. Display and finance reporting only: prices and
  // earn amounts are in coins, so changing this never changes what anyone earns.
  inrPerCoin: z.number().min(0).max(1000).default(0.1),
  streak: z.object({
    // Missed days tolerated before the streak resets (0 = strict: miss a day, start over).
    graceDays:     int(0, 7, 0),
    // Coins for a ladder day that has no row.
    fallbackCoins: int(0, 100000, 1),
    // Ladder length used when no ladder rows exist.
    fallbackCycle: int(1, 365, 7),
  }).default({}),
  caps: z.object({
    // Most coins one user can earn per day from tasks + games (0 = no limit).
    // Check-ins and referrals have their own limits.
    dailyEarnCoins: int(0, 1000000, 0),
  }).default({}),
  referral: z.object({
    referrerCoins: int(0, 100000, 50),
    refereeCoins:  int(0, 100000, 25),
    qualify: z.object({
      // SIGNUP: reward at once. CHECKIN_DAYS: after N daily check-ins.
      // EVENT: after the new user does eventType once.
      type:      z.enum(['SIGNUP', 'CHECKIN_DAYS', 'EVENT']).default('CHECKIN_DAYS'),
      days:      int(1, 365, 3),
      eventType: z.enum(EVENT_TYPES).default('WATCH_VIDEO'),
    }).default({}),
    // Rewarded referrals one person can earn per day / ever (0 = no limit).
    maxPerReferrerPerDay: int(0, 10000, 10),
    maxPerReferrerTotal:  int(0, 1000000, 0),
    // Refuse a signup from a device that already signed up through a referral.
    // Turn off if families commonly share one phone.
    blockSameDevice: z.boolean().default(true),
    // Bonus the referrer gets on reaching their Nth rewarded referral.
    milestones: z.array(z.object({ count: int(1, 100000, 5), coins: int(1, 1000000, 100) })).max(20).default([]),
  }).default({}),
  redeem: z.object({
    // Coins a user must hold before the Rewards screen lets them redeem anything.
    minBalance: int(0, 1000000, 0),
  }).default({}),
  // Event types the app itself may report (POST /coins/events). Everything
  // else is emitted by the server from real activity.
  clientEvents: z.array(z.enum(EVENT_TYPES)).default(['OPEN_APP', 'SHARE', 'PLAY_GAME']),
});

export type CoinConfig = z.infer<typeof coinConfigSchema>;

const KEY = 'coins.config';

export function defaultCoinConfig(): CoinConfig {
  return coinConfigSchema.parse({});
}

export function getCoinConfig(): Promise<CoinConfig> {
  return memo('config', async () => {
    const row = await prisma.appSetting.findUnique({ where: { key: KEY } });
    if (!row) return defaultCoinConfig();
    try {
      const parsed = coinConfigSchema.safeParse(JSON.parse(row.value));
      return parsed.success ? parsed.data : defaultCoinConfig();
    } catch {
      return defaultCoinConfig();
    }
  });
}

export async function saveCoinConfig(input: unknown): Promise<CoinConfig> {
  const next = coinConfigSchema.parse(input);
  await prisma.appSetting.upsert({
    where: { key: KEY },
    create: { key: KEY, value: JSON.stringify(next) },
    update: { value: JSON.stringify(next) },
  });
  invalidateCoinCache();
  return next;
}

// Coins → ₹ (display only).
export function coinsToInr(coins: number, inrPerCoin: number): number {
  return Math.round(coins * inrPerCoin * 100) / 100;
}
