import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { viewerOtpStore, MAX_VIEWER_OTP_ATTEMPTS } from '@/lib/viewerOtpStore';

// Completes viewer signup: confirms the OTP sent by POST /api/auth/viewer-login
// for an email with no existing account, then creates the Viewer.
export async function POST(request: Request) {
  try {
    const { email, otp, password } = await request.json();

    if (!email || !otp || !password) {
      return NextResponse.json({ message: 'Email, OTP and password are required' }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ message: 'Password must be at least 6 characters' }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const key = `signup:${normalizedEmail}`;
    const record = viewerOtpStore.get(key);

    if (!record) {
      return NextResponse.json({ message: 'No verification code requested for this email. Please try logging in again.' }, { status: 400 });
    }
    if (Date.now() > record.expires) {
      viewerOtpStore.delete(key);
      return NextResponse.json({ message: 'Verification code has expired. Please try logging in again.' }, { status: 400 });
    }
    if (record.attempts >= MAX_VIEWER_OTP_ATTEMPTS) {
      viewerOtpStore.delete(key);
      return NextResponse.json({ message: 'Too many incorrect attempts. Please try logging in again.' }, { status: 429 });
    }
    if (record.otp !== otp.trim()) {
      record.attempts += 1;
      return NextResponse.json({ message: 'Invalid verification code' }, { status: 400 });
    }

    viewerOtpStore.delete(key);

    const existing = await prisma.viewer.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return NextResponse.json({ message: 'An account with this email already exists. Please log in.' }, { status: 409 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const viewer = await prisma.viewer.create({
      data: { email: normalizedEmail, password: hashedPassword },
    });

    const token = jwt.sign(
      { id: viewer.id, email: viewer.email, role: 'VIEWER' },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '30d' }
    );

    return NextResponse.json({
      message: 'Account created and logged in',
      token,
      isNew: true,
      user: { id: viewer.id, email: viewer.email, name: viewer.name },
    });
  } catch (error: any) {
    console.error('Viewer verify-signup error:', error);
    if (error?.code === 'P2002') {
      return NextResponse.json({ message: 'An account with this email already exists. Please log in.' }, { status: 409 });
    }
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
