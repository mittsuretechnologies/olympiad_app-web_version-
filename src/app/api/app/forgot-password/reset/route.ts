import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const { resetToken, accountId, newPassword } = await request.json();

    if (!resetToken || !accountId || !newPassword) {
      return NextResponse.json({ message: 'resetToken, accountId and newPassword are required' }, { status: 400 });
    }
    if (typeof newPassword !== 'string' || newPassword.length < 6) {
      return NextResponse.json({ message: 'Password must be at least 6 characters' }, { status: 400 });
    }

    let payload: any;
    try {
      payload = jwt.verify(resetToken, process.env.JWT_SECRET || 'fallback_secret');
    } catch {
      return NextResponse.json({ message: 'Reset session expired. Please start again.' }, { status: 401 });
    }
    if (payload?.purpose !== 'app-password-reset' || !Array.isArray(payload?.accountIds)) {
      return NextResponse.json({ message: 'Invalid reset token' }, { status: 401 });
    }
    if (!payload.accountIds.includes(accountId)) {
      return NextResponse.json({ message: 'This account cannot be reset with this token' }, { status: 403 });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.appUser.update({
      where: { id: accountId },
      data: { password: passwordHash, plainPassword: newPassword },
    });

    return NextResponse.json({ success: true, message: 'Password has been reset' });
  } catch (error) {
    console.error('forgot-password/reset error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
