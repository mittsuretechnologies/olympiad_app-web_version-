import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { verifyResetOtp } from '@/lib/resetOtp';
import { resolveResetAccounts } from '@/lib/resolveResetAccount';

export async function POST(request: Request) {
  try {
    const { identifier, otp } = await request.json();

    if (!identifier || !otp) {
      return NextResponse.json({ message: 'Identifier and OTP are required' }, { status: 400 });
    }

    // Accounts are only revealed after the OTP proves the caller controls
    // this email/mobile — same reveal-after-verification model already used
    // by the signup 409 flow for sibling accounts.
    const accounts = await resolveResetAccounts(identifier);
    if (accounts.length === 0) {
      return NextResponse.json({ message: 'No account found for this contact.' }, { status: 404 });
    }

    // Every match for a given identifier shares the same otpIdentifier (see
    // resolveResetAccounts), so any entry's is representative of the OTP sent.
    const verified = await verifyResetOtp(accounts[0].otpIdentifier, otp);
    if (!verified.ok) {
      return NextResponse.json({ message: verified.message }, { status: verified.status });
    }

    const resetToken = jwt.sign(
      {
        purpose: 'password-reset',
        accounts: accounts.map((a) => ({ id: a.id, kind: a.kind })),
      },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '10m' }
    );

    return NextResponse.json({
      resetToken,
      accounts: accounts.map((a) => ({ id: a.id, userId: a.label, studentName: a.studentName })),
    });
  } catch (error) {
    console.error('app/forgot-password/verify-otp error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
