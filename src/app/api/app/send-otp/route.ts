import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

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

    if (type === 'email') {
      // Email uniquely identifies one account — block if already registered and verified
      const existing = await prisma.appUser.findFirst({ where: { email: id } });
      if (existing?.isVerified) {
        return NextResponse.json(
          { message: 'This account is already registered. Please use the Login screen.' },
          { status: 409 }
        );
      }
    }
    // Mobile numbers can be shared across sibling accounts, so we don't block
    // OTP delivery based on existing AppUser rows for that mobile — the OTP
    // only proves phone ownership; account resolution happens after verification.

    const otp = generateOtp();
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 min

    await prisma.appOtp.upsert({
      where: { identifier: lookupId },
      update: { otpHash, expiresAt },
      create: { identifier: lookupId, otpHash, expiresAt },
    });

    // TODO: In production send OTP via SMS / email provider
    // For now we return it in dev mode
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
