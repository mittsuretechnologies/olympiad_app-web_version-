import { NextResponse } from 'next/server';
import { sendResetOtp } from '@/lib/resetOtp';
import { resolveResetAccount, isEmail, isMobile } from '@/lib/resolveResetAccount';

const GENERIC_MESSAGE = 'If an account exists for this email or mobile number, an OTP has been sent to it.';

export async function POST(request: Request) {
  try {
    const { identifier } = await request.json();

    if (!identifier || typeof identifier !== 'string') {
      return NextResponse.json({ message: 'Email or mobile number is required' }, { status: 400 });
    }

    const id = identifier.trim().toLowerCase();
    const valid = isEmail(id) || isMobile(id.replace(/\D/g, ''));
    if (!valid) {
      return NextResponse.json(
        { message: 'Enter a valid email address or 10-digit mobile number' },
        { status: 400 }
      );
    }

    const account = await resolveResetAccount(id);
    if (!account) {
      // Don't reveal whether the account exists
      return NextResponse.json({ message: GENERIC_MESSAGE });
    }

    const result = await sendResetOtp(account.otpIdentifier);
    if (!result.ok) {
      return NextResponse.json({ message: result.message }, { status: result.status });
    }

    return NextResponse.json({
      message: GENERIC_MESSAGE,
      devOtp: result.devOtp,
    });
  } catch (error) {
    console.error('app/forgot-password/request error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
