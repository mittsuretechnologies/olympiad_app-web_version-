import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { sendOtpEmail } from '@/lib/mailer';

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function isEmail(val: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
}

function isMobile(val: string): boolean {
  return /^[6-9]\d{9}$/.test(val);
}

export async function POST(request: Request) {
  try {
    const { identifier } = await request.json();

    if (!identifier || typeof identifier !== 'string') {
      return NextResponse.json({ message: 'Email or mobile number is required' }, { status: 400 });
    }

    const id = identifier.trim().toLowerCase();
    const type = isEmail(id) ? 'email' : isMobile(id.replace(/\D/g, '')) ? 'mobile' : null;

    if (!type) {
      return NextResponse.json(
        { message: 'Enter a valid email address or 10-digit mobile number' },
        { status: 400 }
      );
    }

    const mobile = type === 'mobile' ? id.replace(/\D/g, '') : null;
    const lookupId = mobile ?? id;

    // Email and mobile can both be shared across sibling accounts, so we
    // don't block OTP delivery based on existing AppUser rows — the OTP only
    // proves contact ownership; account resolution happens after verification.

    const otp = generateOtp();
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 min

    await prisma.appOtp.upsert({
      where: { identifier: lookupId },
      update: { otpHash, expiresAt, attempts: 0 },
      create: { identifier: lookupId, otpHash, expiresAt },
    });

    if (type === 'email') {
      try {
        await sendOtpEmail(id, otp);
        return NextResponse.json({ message: 'OTP sent to your email', type });
      } catch (mailErr) {
        console.error(`OTP email to ${id} failed:`, mailErr);
        // In dev, fall back to returning the OTP so testing isn't blocked.
        if (process.env.NODE_ENV !== 'production') {
          return NextResponse.json({ message: 'OTP sent (dev fallback)', type, devOtp: otp });
        }
        return NextResponse.json(
          { message: 'Could not send the OTP email. Please try again.' },
          { status: 502 }
        );
      }
    }

    // TODO: mobile OTP needs an SMS provider (e.g. MSG91/Twilio); until then
    // the OTP is only available in dev mode.
    console.log(`[DEV] OTP for ${lookupId}: ${otp}`);

    return NextResponse.json({
      message: 'OTP sent successfully',
      type,
      devOtp: process.env.NODE_ENV !== 'production' ? otp : undefined,
    });
  } catch (error) {
    console.error('send-otp error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
