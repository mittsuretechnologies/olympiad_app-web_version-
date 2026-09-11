import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

// Student self-registration OTPs. Previously an in-process Map, which lost state
// across serverless instances (register and verify can land on different ones)
// and held the OTP in cleartext. Now DB-backed and bcrypt-hashed, matching the
// AppOtp / PasswordResetOtp flows.

export const MAX_OTP_ATTEMPTS = 5;
const OTP_TTL_MS = 5 * 60 * 1000;

export function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function saveRegistrationOtp(
  olympiadCode: string,
  otp: string,
  name: string,
  phone: string
): Promise<void> {
  const otpHash = await bcrypt.hash(otp, 10);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);
  await prisma.studentRegistrationOtp.upsert({
    where: { olympiadCode },
    update: { otpHash, name, phone, expiresAt, attempts: 0 },
    create: { olympiadCode, otpHash, name, phone, expiresAt },
  });
}

export type VerifyRegistrationOtpResult =
  | { ok: true; name: string; phone: string }
  | { ok: false; status: number; message: string };

export async function verifyRegistrationOtp(
  olympiadCode: string,
  otp: string
): Promise<VerifyRegistrationOtpResult> {
  const record = await prisma.studentRegistrationOtp.findUnique({ where: { olympiadCode } });

  if (!record) {
    return { ok: false, status: 400, message: 'OTP expired or not found. Please request again.' };
  }
  if (record.expiresAt < new Date()) {
    await prisma.studentRegistrationOtp.delete({ where: { olympiadCode } }).catch(() => {});
    return { ok: false, status: 400, message: 'OTP expired. Please request again.' };
  }
  if (record.attempts >= MAX_OTP_ATTEMPTS) {
    await prisma.studentRegistrationOtp.delete({ where: { olympiadCode } }).catch(() => {});
    return { ok: false, status: 429, message: 'Too many incorrect attempts. Please request a new OTP.' };
  }

  const match = await bcrypt.compare(otp.trim(), record.otpHash);
  if (!match) {
    await prisma.studentRegistrationOtp
      .update({ where: { olympiadCode }, data: { attempts: { increment: 1 } } })
      .catch(() => {});
    return { ok: false, status: 400, message: 'Invalid OTP' };
  }

  await prisma.studentRegistrationOtp.delete({ where: { olympiadCode } }).catch(() => {});
  return { ok: true, name: record.name, phone: record.phone };
}
