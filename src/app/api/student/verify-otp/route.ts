import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { verifyRegistrationOtp } from '@/lib/otpStore';
import { getJwtSecret } from '@/lib/jwt-secret';
import { encryptPassword } from '@/lib/password-crypto';

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
    const verified = await verifyRegistrationOtp(code, otp);

    if (!verified.ok) {
      return NextResponse.json({ message: verified.message }, { status: verified.status });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const student = await prisma.student.create({
      data: {
        olympiadCode: code,
        name: verified.name,
        phone: verified.phone,
        password: hashedPassword,
        plainPassword: encryptPassword(password),
        isVerified: true,
      },
    });

    // No status update needed — student relation itself indicates registration

    const token = jwt.sign(
      { id: student.id, olympiadCode: code, role: 'STUDENT' },
      getJwtSecret(),
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
