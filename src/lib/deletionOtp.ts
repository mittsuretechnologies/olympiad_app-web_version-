import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

const MAX_ATTEMPTS = 5;

// Keyed per account, not per phone/email: sibling accounts share a contact,
// and a code requested to delete one must never delete another.
export const deletionOtpKey = (appUserId: string) => `delete:${appUserId}`;

export type DeletionOtpCheck = { ok: true } | { ok: false; status: number; message: string };

// Single-use: a correct code is burned immediately.
export async function verifyDeletionOtp(appUserId: string, otp: unknown): Promise<DeletionOtpCheck> {
  if (typeof otp !== 'string' || !/^\d{6}$/.test(otp.trim())) {
    return { ok: false, status: 400, message: 'Enter the 6-digit code we sent you.' };
  }

  const key = deletionOtpKey(appUserId);
  const record = await prisma.appOtp.findUnique({ where: { identifier: key } });
  if (!record) {
    return { ok: false, status: 400, message: 'No code was requested. Please request a new code.' };
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
