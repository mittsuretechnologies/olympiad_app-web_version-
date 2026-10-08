import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

const OTP_TTL_MS = 5 * 60 * 1000; // 5 min
const RESEND_COOLDOWN_MS = 60 * 1000; // 60 sec
const MAX_ATTEMPTS = 5;

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export type SendOtpResult =
  | { ok: true; devOtp?: string }
  | { ok: false; status: number; message: string };

export type IssueOtpResult =
  | { ok: true; otp: string }
  | { ok: false; status: number; message: string };

/**
 * Stores a fresh hashed OTP under `identifier` and hands the plain code back so
 * the caller can deliver it itself (email/SMS). Same cooldown, TTL and attempt
 * limits as sendResetOtp, and verified with verifyResetOtp.
 */
export async function issueOtp(identifier: string): Promise<IssueOtpResult> {
  const existing = await prisma.passwordResetOtp.findUnique({ where: { identifier } });

  if (existing && Date.now() - existing.lastSentAt.getTime() < RESEND_COOLDOWN_MS) {
    return { ok: false, status: 429, message: 'Please wait a minute before requesting another OTP.' };
  }

  const otp = generateOtp();
  const otpHash = await bcrypt.hash(otp, 10);
  const now = new Date();
  await prisma.passwordResetOtp.upsert({
    where: { identifier },
    update: { otpHash, expiresAt: new Date(now.getTime() + OTP_TTL_MS), lastSentAt: now, attempts: 0 },
    create: { identifier, otpHash, expiresAt: new Date(now.getTime() + OTP_TTL_MS), lastSentAt: now },
  });
  return { ok: true, otp };
}

export async function sendResetOtp(identifier: string): Promise<SendOtpResult> {
  const existing = await prisma.passwordResetOtp.findUnique({ where: { identifier } });

  if (existing && Date.now() - existing.lastSentAt.getTime() < RESEND_COOLDOWN_MS) {
    return { ok: false, status: 429, message: 'Please wait a minute before requesting another OTP.' };
  }

  const otp = generateOtp();
  const otpHash = await bcrypt.hash(otp, 10);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + OTP_TTL_MS);

  await prisma.passwordResetOtp.upsert({
    where: { identifier },
    update: { otpHash, expiresAt, lastSentAt: now, attempts: 0 },
    create: { identifier, otpHash, expiresAt, lastSentAt: now },
  });

  // TODO: In production send OTP via SMS / email provider
  console.log(`[DEV] Password reset OTP for ${identifier}: ${otp}`);

  return { ok: true, devOtp: process.env.NODE_ENV !== 'production' ? otp : undefined };
}

export type VerifyOtpResult =
  | { ok: true }
  | { ok: false; status: number; message: string };

export async function verifyResetOtp(identifier: string, otp: string): Promise<VerifyOtpResult> {
  const record = await prisma.passwordResetOtp.findUnique({ where: { identifier } });

  if (!record) {
    return { ok: false, status: 400, message: 'No OTP was sent to this contact. Please request a new OTP.' };
  }
  if (record.expiresAt < new Date()) {
    await prisma.passwordResetOtp.delete({ where: { identifier } }).catch(() => {});
    return { ok: false, status: 400, message: 'OTP has expired. Please request a new one.' };
  }
  if (record.attempts >= MAX_ATTEMPTS) {
    await prisma.passwordResetOtp.delete({ where: { identifier } }).catch(() => {});
    return { ok: false, status: 429, message: 'Too many incorrect attempts. Please request a new OTP.' };
  }

  const match = await bcrypt.compare(otp.trim(), record.otpHash);
  if (!match) {
    await prisma.passwordResetOtp.update({
      where: { identifier },
      data: { attempts: { increment: 1 } },
    }).catch(() => {});
    return { ok: false, status: 400, message: 'Invalid OTP. Please check and try again.' };
  }

  await prisma.passwordResetOtp.delete({ where: { identifier } }).catch(() => {});
  return { ok: true };
}
