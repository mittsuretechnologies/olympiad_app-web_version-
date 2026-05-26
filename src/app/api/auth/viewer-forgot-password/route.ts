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

    if (!viewer) {
      return NextResponse.json({ message: 'No account found with this email' }, { status: 404 });
    }

    const otp     = String(Math.floor(100000 + Math.random() * 900000));
    const expires = Date.now() + 5 * 60 * 1000; // 5 min

    viewerOtpStore.set(normalized, { otp, expires });

    // TODO: Send real email (SendGrid / NodeMailer) in production
    console.log(`[VIEWER OTP] Email: ${normalized} | OTP: ${otp}`);

    return NextResponse.json({
      message: 'OTP sent to your email',
      ...(process.env.NODE_ENV === 'development' ? { devOtp: otp } : {}),
    });
  } catch (error) {
    console.error('viewer-forgot-password failed:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
