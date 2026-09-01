import { prisma } from '@/lib/prisma';

/**
 * Resend cooldown for AppOtp-backed flows. Without this, every request to an
 * OTP endpoint dispatches a billed SMS, so a trivial loop against a public
 * endpoint drains the SMS account. Mirrors the 60s cooldown that the
 * PasswordResetOtp flow already enforces in resetOtp.ts.
 */
const RESEND_COOLDOWN_MS = readLimit('OTP_RESEND_COOLDOWN_SECONDS', 60) * 1000;

/**
 * Number of sends allowed per identifier per day, as a backstop against a
 * slow drip that stays under the per-request cooldown.
 */
const MAX_SENDS_PER_DAY = readLimit('OTP_MAX_SENDS_PER_DAY', 10);

/**
 * Limits are tunable from .env, but a malformed or zero value would silently
 * disable throttling on a billed endpoint, so anything non-positive falls back
 * to the default rather than being trusted.
 */
function readLimit(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

export type RateLimitResult = { allowed: true } | { allowed: false; message: string };

export async function checkOtpResendAllowed(identifier: string): Promise<RateLimitResult> {
  const existing = await prisma.otpSendLimit.findUnique({
    where: { identifier },
    select: { lastSentAt: true, sendsToday: true, sendCountDate: true },
  });

  if (!existing) return { allowed: true };

  const sinceLastSend = Date.now() - existing.lastSentAt.getTime();
  if (sinceLastSend < RESEND_COOLDOWN_MS) {
    const wait = Math.ceil((RESEND_COOLDOWN_MS - sinceLastSend) / 1000);
    return { allowed: false, message: `Please wait ${wait}s before requesting another OTP.` };
  }

  // The daily counter resets on the first send of a new UTC day rather than on
  // a rolling window, so a stale count from yesterday never blocks a user.
  const today = new Date().toISOString().slice(0, 10);
  if (existing.sendCountDate === today && existing.sendsToday >= MAX_SENDS_PER_DAY) {
    return {
      allowed: false,
      message: 'Too many OTP requests today. Please try again tomorrow or contact support.',
    };
  }

  return { allowed: true };
}

/**
 * Records a dispatch against the identifier, rolling the daily count over when
 * the stored date isn't today. Call this for every send that is actually
 * attempted, so a failed gateway call still counts toward the cooldown and a
 * retry loop can't hammer the provider.
 */
export async function recordOtpSend(identifier: string): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const existing = await prisma.otpSendLimit.findUnique({
    where: { identifier },
    select: { sendsToday: true, sendCountDate: true },
  });

  const sendsToday = existing && existing.sendCountDate === today ? existing.sendsToday + 1 : 1;
  const counters = { lastSentAt: new Date(), sendsToday, sendCountDate: today };

  await prisma.otpSendLimit.upsert({
    where: { identifier },
    update: counters,
    create: { identifier, ...counters },
  });
}
