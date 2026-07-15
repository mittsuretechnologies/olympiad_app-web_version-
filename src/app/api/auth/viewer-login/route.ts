import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { viewerOtpStore } from '@/lib/viewerOtpStore';
import { sendOtpEmail } from '@/lib/mailer';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { message: 'Email and password are required' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await prisma.viewer.findUnique({ where: { email: normalizedEmail } });

    if (existing) {
      // Returning viewer — verify password
      const ok = await bcrypt.compare(password, existing.password);
      if (!ok) {
        return NextResponse.json({ message: 'Invalid password' }, { status: 401 });
      }
      const token = jwt.sign(
        { id: existing.id, email: existing.email, role: 'VIEWER' },
        process.env.JWT_SECRET || 'fallback_secret',
        { expiresIn: '30d' }
      );
      return NextResponse.json({
        message: 'Login successful',
        token,
        isNew: false,
        user: { id: existing.id, email: existing.email, name: existing.name },
      });
    }

    // No account yet for this email — don't create one on the spot (that let
    // an attacker squat any email they didn't own). Send a signup OTP instead;
    // the account is only created once /viewer-verify-signup confirms it.
    if (password.length < 6) {
      return NextResponse.json({ message: 'Password must be at least 6 characters' }, { status: 400 });
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const expires = Date.now() + 5 * 60 * 1000; // 5 min
    viewerOtpStore.set(`signup:${normalizedEmail}`, { otp, expires, attempts: 0 });

    try {
      await sendOtpEmail(normalizedEmail, otp, 'signup');
    } catch (mailErr) {
      console.error(`Signup OTP email to ${normalizedEmail} failed:`, mailErr);
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ message: 'Could not send the verification email. Please try again.' }, { status: 502 });
      }
    }

    return NextResponse.json({
      message: 'No account found for this email. A verification code has been sent — confirm it to create your account.',
      isNew: true,
      requiresVerification: true,
      ...(process.env.NODE_ENV !== 'production' ? { devOtp: otp } : {}),
    });
  } catch (error) {
    console.error('Viewer login error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
