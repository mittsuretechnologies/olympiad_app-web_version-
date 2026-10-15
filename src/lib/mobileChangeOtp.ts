import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

const MAX_ATTEMPTS = 5;

// Keyed per account AND the new number: a code requested for one number can
// never be used to switch the account to a different one, and sibling accounts
// (who may share a phone) never see each other's codes.
export const mobileChangeOtpKey = (appUserId: string, newMobile: string) =>
  `mobile-change:${appUserId}:${newMobile}`;

export type MobileChangeOtpCheck = { ok: true } | { ok: false; status: number; message: string };

// Single-use: a correct code is burned immediately.
export async function verifyMobileChangeOtp(
  appUserId: string,
  newMobile: string,
  otp: unknown,
): Promise<MobileChangeOtpCheck> {
  if (typeof otp !== 'string' || !/^\d{6}$/.test(otp.trim())) {
    return { ok: false, status: 400, message: 'Enter the 6-digit code we sent to your new number.' };
  }

  const key = mobileChangeOtpKey(appUserId, newMobile);
  const record = await prisma.appOtp.findUnique({ where: { identifier: key } });
  if (!record) {
    return { ok: false, status: 400, message: 'No code was requested for this number. Please request a new code.' };
  }
  if (record.expiresAt < new Date()) {
    await prisma.appOtp.delete({ where: { identifier: key } }).catch(() => {});
    return { ok: false, status: 400, message: 'This code has expired. Please request a new one.' };
  }
  if (record.attempts >= MAX_ATTEMPTS) {
    await prisma.appOtp.delete({ where: { identifier: key } }).catch(() => {});
    return { ok: false, status: 429, message: 'Too many incorrect attempts. Please request a new code.' };
  }

  if (!(await bcrypt.compare(otp.trim(), record.otpHash))) {
    await prisma.appOtp.update({ where: { identifier: key }, data: { attempts: { increment: 1 } } }).catch(() => {});
    return { ok: false, status: 400, message: 'Incorrect code. Please check and try again.' };
  }

  await prisma.appOtp.delete({ where: { identifier: key } }).catch(() => {});
  return { ok: true };
}
