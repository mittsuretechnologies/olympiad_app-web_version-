import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { verifyResetOtp } from '@/lib/resetOtp';
import { resolveResetAccount } from '@/lib/resolveResetAccount';

export async function POST(request: Request) {
  try {
    const { identifier, otp, newPassword } = await request.json();

    if (!identifier || !otp || !newPassword) {
      return NextResponse.json({ message: 'All fields are required' }, { status: 400 });
    }
    if (newPassword.length < 6) {
      return NextResponse.json({ message: 'Password must be at least 6 characters' }, { status: 400 });
    }

    const account = await resolveResetAccount(identifier);
    if (!account) {
      return NextResponse.json({ message: 'No account found for this contact.' }, { status: 404 });
    }

    const verified = await verifyResetOtp(account.otpIdentifier, otp);
    if (!verified.ok) {
      return NextResponse.json({ message: verified.message }, { status: verified.status });
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
