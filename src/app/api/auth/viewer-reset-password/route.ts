import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { viewerOtpStore, MAX_VIEWER_OTP_ATTEMPTS } from '@/lib/viewerOtpStore';

export async function POST(request: Request) {
  try {
    const { email, otp, newPassword } = await request.json();

    if (!email?.trim() || !otp?.trim() || !newPassword) {
      return NextResponse.json({ message: 'Email, OTP and new password are required' }, { status: 400 });
    }
    if (newPassword.length < 6) {
      return NextResponse.json({ message: 'Password must be at least 6 characters' }, { status: 400 });
    }

    const normalized = email.trim().toLowerCase();
    const record     = viewerOtpStore.get(normalized);

    if (!record) {
      return NextResponse.json({ message: 'No OTP requested for this email. Please request a new one.' }, { status: 400 });
    }
    if (Date.now() > record.expires) {
      viewerOtpStore.delete(normalized);
      return NextResponse.json({ message: 'OTP has expired. Please request a new one.' }, { status: 400 });
    }
    if (record.attempts >= MAX_VIEWER_OTP_ATTEMPTS) {
      viewerOtpStore.delete(normalized);
      return NextResponse.json({ message: 'Too many incorrect attempts. Please request a new OTP.' }, { status: 429 });
    }
    if (record.otp !== otp.trim()) {
      record.attempts += 1;
      return NextResponse.json({ message: 'Invalid OTP. Please check and try again.' }, { status: 400 });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.viewer.update({
      where: { email: normalized },
      data:  { password: hashed },
    });

    viewerOtpStore.delete(normalized);

    return NextResponse.json({ message: 'Password reset successfully. Please login with your new password.' });
  } catch (error) {
    console.error('viewer-reset-password failed:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
