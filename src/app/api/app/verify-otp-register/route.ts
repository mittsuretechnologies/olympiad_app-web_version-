import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { generateUserId } from '@/lib/generateUserId';

function isEmail(val: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
}


export async function POST(request: Request) {
  try {
    const { identifier, otp, password } = await request.json();

    if (!identifier || !otp || !password) {
      return NextResponse.json({ message: 'All fields are required' }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ message: 'Password must be at least 6 characters' }, { status: 400 });
    }

    const id = identifier.trim().toLowerCase();
    const mobile = !isEmail(id) ? id.replace(/\D/g, '') : null;
    const lookupId = mobile ?? id;

    const record = await prisma.appOtp.findUnique({ where: { identifier: lookupId } });
    if (!record) {
      return NextResponse.json({ message: 'No OTP was sent to this contact. Please request a new OTP.' }, { status: 400 });
    }
    if (record.expiresAt < new Date()) {
      return NextResponse.json({ message: 'OTP has expired. Please request a new one.' }, { status: 400 });
    }

    const otpMatch = await bcrypt.compare(otp.trim(), record.otpHash);
    if (!otpMatch) {
      return NextResponse.json({ message: 'Invalid OTP. Please check and try again.' }, { status: 400 });
    }

    // Self-signup: name unknown at this point → mittsure_xxxx prefix
    const userId = await generateUserId(null);

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.appUser.upsert({
      where: mobile ? { mobile } : { email: id },
      update: {
        password: passwordHash,
        plainPassword: password,
        isVerified: true,
        termsAccepted: true,
      },
      create: {
        userId,
        email: mobile ? null : id,
        mobile: mobile ?? null,
        password: passwordHash,
        plainPassword: password,
        isVerified: true,
        termsAccepted: true,
      },
    });

    // Delete used OTP
    await prisma.appOtp.delete({ where: { identifier: lookupId } }).catch(() => {});

    const token = jwt.sign(
      { id: user.id, userId: user.userId, role: 'APP_USER' },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '30d' }
    );

    return NextResponse.json({
      message: 'Registration successful',
      token,
      user: {
        id: user.id,
        userId: user.userId,
        email: user.email,
        mobile: user.mobile,
      },
    });
  } catch (error) {
    console.error('verify-otp-register error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
