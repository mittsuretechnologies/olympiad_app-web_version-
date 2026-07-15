import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { viewerOtpStore } from '@/lib/viewerOtpStore';

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email?.trim()) {
      return NextResponse.json({ message: 'Email is required' }, { status: 400 });
    }

    const normalized = email.trim().toLowerCase();
    const viewer = await prisma.viewer.findUnique({ where: { email: normalized } });

    // Always return the same response whether or not the account exists, so
    // this endpoint can't be used to enumerate registered viewer emails.
    if (viewer) {
      const otp     = String(Math.floor(100000 + Math.random() * 900000));
      const expires = Date.now() + 5 * 60 * 1000; // 5 min

      viewerOtpStore.set(normalized, { otp, expires, attempts: 0 });

      // TODO: Send real email (SendGrid / NodeMailer) in production
      console.log(`[VIEWER OTP] Email: ${normalized} | OTP: ${otp}`);

      return NextResponse.json({
        message: 'If an account exists for this email, an OTP has been sent.',
        ...(process.env.NODE_ENV === 'development' ? { devOtp: otp } : {}),
      });
    }

    return NextResponse.json({
      message: 'If an account exists for this email, an OTP has been sent.',
    });
  } catch (error) {
    console.error('viewer-forgot-password failed:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
