import { randomBytes } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getCoinConfig } from './config';
import { applyCoins, assertCoinsOn, coinTransaction, ensureWallet, lockWallet } from './ledger';
import { istDateKey, istDayStart } from './time';

// Refer & earn. A referral is created PENDING when someone signs up with a
// friend's code, and pays out once the new user "qualifies" (Settings →
// Referral): straight away, after N daily check-ins, or after one real action.
// Paying only for engaged users is what makes farming fake accounts unprofitable.

export const APPLY_WINDOW_MS = 7 * 86_400_000;

export const REFERRAL_MESSAGES: Record<string, string> = {
  INVALID_CODE: "That invite code wasn't found. Please check it and try again.",
  SELF: "You can't use your own invite code.",
  SAME_PHONE: "An invite code can't be used with the same phone number as the person who invited you.",
  SAME_DEVICE: 'This phone has already been used with an invite code.',
  DISABLED: 'Invite rewards are not available right now.',
  ERROR: 'Something went wrong. Please try again.',
};

// No 0/O/1/I/L — codes get read aloud and typed by hand.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function randomCode(len = 7) {
  const bytes = randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

export function normalizeReferralCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const c = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  return c.length >= 4 && c.length <= 12 ? c : null;
}

// Codes already looked up, so the common case costs no query.
const codeCache = new Map<string, string>();

export async function ensureReferralCode(appUserId: string): Promise<string> {
  const cached = codeCache.get(appUserId);
  if (cached) return cached;
  const code = await createReferralCode(appUserId);
  if (codeCache.size > 20000) codeCache.clear();
  codeCache.set(appUserId, code);
  return code;
}

async function createReferralCode(appUserId: string): Promise<string> {
  const u = await prisma.appUser.findUnique({ where: { id: appUserId }, select: { referralCode: true } });
  if (u?.referralCode) return u.referralCode;
  for (let i = 0; i < 6; i++) {
    const code = randomCode();
    try {
      // Only fills an empty slot, so two simultaneous calls end with one code.
      const r = await prisma.appUser.updateMany({ where: { id: appUserId, referralCode: null }, data: { referralCode: code } });
      if (r.count === 0) {
        const again = await prisma.appUser.findUnique({ where: { id: appUserId }, select: { referralCode: true } });
        if (again?.referralCode) return again.referralCode;
      } else {
        return code;
      }
    } catch (e) {
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')) throw e;   // code taken, retry
    }
  }
  throw new Error('Could not generate a referral code');
}

// Called at signup. Never throws into the signup flow: a bad code just means
// "no referral", never "no account".
export async function attachReferral(args: {
  refereeId: string;
  code: unknown;
  deviceId?: unknown;
  ip?: string | null;
  mobile?: string | null;
}): Promise<{ attached: boolean; reason?: string }> {
  const cfg = await getCoinConfig();
  if (!cfg.enabled || !cfg.features.referral) return { attached: false, reason: 'DISABLED' };
  const code = normalizeReferralCode(args.code);
  if (!code) return { attached: false, reason: 'INVALID_CODE' };

  const referrer = await prisma.appUser.findUnique({
    where: { referralCode: code },
    select: { id: true, mobile: true, accountType: true },
  });
  if (!referrer || referrer.accountType !== 'USER') return { attached: false, reason: 'INVALID_CODE' };
  if (referrer.id === args.refereeId) return { attached: false, reason: 'SELF' };
  // Same phone number = the same person (siblings share a parent's number, but
  // an account referring itself through a second account is the classic abuse).
  if (referrer.mobile && args.mobile && referrer.mobile === args.mobile) return { attached: false, reason: 'SAME_PHONE' };

  const deviceId = typeof args.deviceId === 'string' && args.deviceId.length <= 100 ? args.deviceId : null;
  let status = 'PENDING';
  let rejectReason: string | null = null;
  if (deviceId && cfg.referral.blockSameDevice) {
    const used = await prisma.referral.findFirst({ where: { deviceId, status: { not: 'REJECTED' } }, select: { id: true } });
    if (used) { status = 'REJECTED'; rejectReason = 'SAME_DEVICE'; }
  }

  try {
    await prisma.$transaction([
      prisma.referral.create({
        data: { referrerId: referrer.id, refereeId: args.refereeId, code, status, rejectReason, deviceId, ip: args.ip ?? null },
      }),
      prisma.appUser.update({ where: { id: args.refereeId }, data: { referredById: referrer.id } }),
    ]);
  } catch (e) {
    console.error('[coins] attachReferral', e);
    return { attached: false, reason: 'ERROR' };
  }
  if (status === 'PENDING' && cfg.referral.qualify.type === 'SIGNUP') {
    await payReferral(args.refereeId).catch((e) => console.error('[coins] payReferral', e));
  }
  return status === 'PENDING' ? { attached: true } : { attached: false, reason: rejectReason ?? 'BLOCKED' };
}

// Called after a check-in / a task event. Cheap when there is nothing to do:
// one indexed lookup, and only for users who actually joined by a code.
export async function evaluateReferral(
  refereeId: string,
  trigger: { type: 'CHECKIN' } | { type: 'EVENT'; eventType: string },
): Promise<void> {
  const cfg = await getCoinConfig();
  if (!cfg.enabled || !cfg.features.referral) return;
  const q = cfg.referral.qualify;
  if (trigger.type === 'CHECKIN' && q.type !== 'CHECKIN_DAYS') return;
  if (trigger.type === 'EVENT' && !(q.type === 'EVENT' && q.eventType === trigger.eventType)) return;

  const ref = await prisma.referral.findUnique({ where: { refereeId }, select: { status: true } });
  if (!ref || ref.status !== 'PENDING') return;
  if (q.type === 'CHECKIN_DAYS') {
    const days = await prisma.coinCheckin.count({ where: { appUserId: refereeId } });
    if (days < q.days) return;
  }
  await payReferral(refereeId);
}

// Pays out a PENDING referral exactly once. `force` (admin approval) skips the
// referrer's caps, not the once-only guard.
export async function payReferral(refereeId: string, force = false): Promise<boolean> {
  const cfg = await getCoinConfig();
  const ref = await prisma.referral.findUnique({ where: { refereeId } });
  if (!ref || (ref.status !== 'PENDING' && !(force && ref.status === 'REJECTED'))) return false;

  await ensureWallet(ref.referrerId);
  await ensureWallet(ref.refereeId);

  // Referrer limits are checked before the transaction so the referee is still
  // rewarded when the referrer has simply hit their cap.
  let referrerCoins = cfg.referral.referrerCoins;
  if (!force) {
    const { maxPerReferrerPerDay: perDay, maxPerReferrerTotal: total } = cfg.referral;
    const [today, all] = await Promise.all([
      perDay ? prisma.referral.count({ where: { referrerId: ref.referrerId, status: 'REWARDED', rewardedAt: { gte: istDayStart(istDateKey()) } } }) : 0,
      total ? prisma.referral.count({ where: { referrerId: ref.referrerId, status: 'REWARDED' } }) : 0,
    ]);
    if ((perDay && today >= perDay) || (total && all >= total)) referrerCoins = 0;
  }
  const refereeCoins = cfg.referral.refereeCoins;

  return coinTransaction(
    async (tx) => {
      // The atomic step that makes the payout once-only.
      const claimed = await tx.referral.updateMany({
        where: { id: ref.id, status: ref.status },
        data: { status: 'REWARDED', rewardedAt: new Date(), referrerCoins, refereeCoins, rejectReason: null },
      });
      if (claimed.count !== 1) return false;

      await lockWallet(tx, ref.refereeId);
      if (refereeCoins > 0) {
        await applyCoins(tx, {
          appUserId: ref.refereeId, amount: refereeCoins, type: 'REFERRAL_REFEREE',
          key: `ref:${ref.id}:referee`, sourceType: 'referral', sourceId: ref.id, note: 'Joined with a friend’s code',
        });
      }
      await lockWallet(tx, ref.referrerId);
      if (referrerCoins > 0) {
        await applyCoins(tx, {
          appUserId: ref.referrerId, amount: referrerCoins, type: 'REFERRAL_REFERRER',
          key: `ref:${ref.id}:referrer`, sourceType: 'referral', sourceId: ref.id, note: 'A friend you invited is active',
        });
      }
      if (referrerCoins > 0) {
        const n = await tx.referral.count({ where: { referrerId: ref.referrerId, status: 'REWARDED' } });
        const m = cfg.referral.milestones.find((x) => x.count === n);
        if (m) {
          await applyCoins(tx, {
            appUserId: ref.referrerId, amount: m.coins, type: 'REFERRAL_MILESTONE',
            key: `refmile:${ref.referrerId}:${n}`, sourceType: 'referral', sourceId: ref.id, note: `${n} friends joined`,
          });
        }
      }
      return true;
    },
    async () => false,
  );
}

export async function referralSummary(appUserId: string) {
  await assertCoinsOn('referral');
  const [code, cfg, rows, rewarded, me] = await Promise.all([
    ensureReferralCode(appUserId),
    getCoinConfig(),
    prisma.referral.findMany({
      where: { referrerId: appUserId, status: { not: 'REJECTED' } },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, status: true, referrerCoins: true, createdAt: true, referee: { select: { userId: true, avatarUrl: true } } },
    }),
    prisma.referral.aggregate({ where: { referrerId: appUserId, status: 'REWARDED' }, _count: true, _sum: { referrerCoins: true } }),
    prisma.appUser.findUnique({ where: { id: appUserId }, select: { referredById: true, createdAt: true } }),
  ]);
  const q = cfg.referral.qualify;
  const rule =
    q.type === 'SIGNUP' ? 'joins using your code'
    : q.type === 'CHECKIN_DAYS' ? `collects daily coins for ${q.days} day${q.days > 1 ? 's' : ''}`
    : 'gets started in the app';
  // A friend's code can still be entered for a week after signing up, if none was used.
  const canApply = !!me && !me.referredById && Date.now() - me.createdAt.getTime() <= APPLY_WINDOW_MS;
  return {
    code,
    canApply,
    referrerCoins: cfg.referral.referrerCoins,
    refereeCoins: cfg.referral.refereeCoins,
    rule,
    milestones: cfg.referral.milestones,
    joined: rows.length,
    rewarded: rewarded._count,
    earned: rewarded._sum.referrerCoins ?? 0,
    friends: rows.map((r) => ({
      id: r.id,
      userId: r.referee.userId,
      avatarUrl: r.referee.avatarUrl,
      status: r.status,
      coins: r.referrerCoins,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}
