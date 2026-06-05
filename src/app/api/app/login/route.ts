import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const { userId, password } = await request.json();

    if (!userId || !password) {
      return NextResponse.json({ message: 'User ID and password are required' }, { status: 400 });
    }

    const user = await prisma.appUser.findUnique({
      where: { userId: userId.trim().toUpperCase() },
    });

    if (!user) {
      return NextResponse.json(
        { message: `No account found with User ID "${userId.trim().toUpperCase()}". Please check your ID or sign up.` },
        { status: 401 }
      );
    }
    if (!user.isVerified) {
      return NextResponse.json(
        { message: 'Account not fully registered. Please complete signup.' },
        { status: 401 }
      );
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return NextResponse.json({ message: 'Incorrect password. Please try again.' }, { status: 401 });
    }

    const token = jwt.sign(
      { id: user.id, userId: user.userId, role: 'APP_USER' },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '30d' }
    );

    return NextResponse.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        userId: user.userId,
        email: user.email,
        mobile: user.mobile,
        olympiadId: user.olympiadId,
      },
    });
  } catch (error) {
    console.error('app-login error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
