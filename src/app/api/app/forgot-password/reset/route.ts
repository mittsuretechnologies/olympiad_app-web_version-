import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';

type ResetTokenPayload = {
  purpose: string;
  accounts: { id: string; kind: 'APP_USER' | 'STUDENT' }[];
};

export async function POST(request: Request) {
  try {
    const { resetToken, accountId, newPassword } = await request.json();

    if (!resetToken || !accountId || !newPassword) {
      return NextResponse.json({ message: 'All fields are required' }, { status: 400 });
    }
    if (newPassword.length < 6) {
      return NextResponse.json({ message: 'Password must be at least 6 characters' }, { status: 400 });
    }

    let payload: ResetTokenPayload;
    try {
      payload = jwt.verify(resetToken, process.env.JWT_SECRET || 'fallback_secret') as ResetTokenPayload;
    } catch {
      return NextResponse.json({ message: 'Reset session expired. Please request a new OTP.' }, { status: 400 });
    }
    if (payload.purpose !== 'password-reset') {
      return NextResponse.json({ message: 'Invalid reset session.' }, { status: 400 });
    }

    const account = payload.accounts.find((a) => a.id === accountId);
    if (!account) {
      return NextResponse.json({ message: 'Select one of the accounts shown for this contact.' }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    if (account.kind === 'APP_USER') {
      await prisma.appUser.update({
        where: { id: account.id },
        data: { password: passwordHash, plainPassword: newPassword },
      });
    } else {
      await prisma.student.update({
        where: { id: account.id },
        data: { password: passwordHash, plainPassword: newPassword },
      });
    }

    return NextResponse.json({ message: 'Password reset successfully. Please log in with your new password.' });
  } catch (error) {
    console.error('app/forgot-password/reset error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
