import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { otpStore } from '../register/route';

export async function POST(request: Request) {
  try {
    const { olympiadCode, otp, password } = await request.json();

    if (!olympiadCode || !otp || !password) {
      return NextResponse.json(
        { message: 'Olympiad ID, OTP and password are required' },
        { status: 400 }
      );
    }

    const code = olympiadCode.trim();
    const stored = otpStore.get(code);

    if (!stored) {
      return NextResponse.json({ message: 'OTP expired or not found. Please request again.' }, { status: 400 });
    }
    if (Date.now() > stored.expires) {
      otpStore.delete(code);
      return NextResponse.json({ message: 'OTP expired. Please request again.' }, { status: 400 });
    }
    if (stored.otp !== otp.trim()) {
      return NextResponse.json({ message: 'Invalid OTP' }, { status: 400 });
    }

    // OTP valid — create student
    otpStore.delete(code);
    const hashedPassword = await bcrypt.hash(password, 10);

    const student = await prisma.student.create({
      data: {
        olympiadCode: code,
        name: stored.name,
        phone: stored.phone,
        password: hashedPassword,
        isVerified: true,
      },
    });

    // No status update needed — student relation itself indicates registration

    const token = jwt.sign(
      { id: student.id, olympiadCode: code, role: 'STUDENT' },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '30d' }
    );

    return NextResponse.json({
      message: 'Registration successful',
      token,
      user: {
        id: student.id,
        name: student.name,
        olympiadCode: code,
      },
    });
  } catch (error: any) {
    console.error('POST student/verify-otp failed:', error);
    if (error?.code === 'P2002') {
      return NextResponse.json({ message: 'This Olympiad ID is already registered' }, { status: 409 });
    }
    return NextResponse.json({ message: 'Registration failed' }, { status: 500 });
  }
}
