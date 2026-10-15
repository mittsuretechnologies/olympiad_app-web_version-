import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { verify } from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { getJwtSecret } from '@/lib/jwt-secret';
import { sendOtpSms } from '@/lib/sms';
import { checkOtpResendAllowed, recordOtpSend } from '@/lib/otpRateLimit';
import { mobileChangeOtpKey } from '@/lib/mobileChangeOtp';

function getAppUserId(request: Request): string | null {
  const auth = request.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return null;
  try {
    const decoded = verify(auth.slice(7), getJwtSecret()) as any;
    return decoded.role === 'APP_USER' ? decoded.id : null;
  } catch {
    return null;
  }
}

const maskMobile = (m: string) => `******${m.slice(-4)}`;

// POST /api/app/profile/mobile-otp  { mobile }
// Sends a 6-digit code by SMS to the NEW number, proving the account holder owns
// it. PATCH /api/app/profile refuses a mobile change without that code, so a
// left-logged-in session can't quietly redirect the account's OTPs elsewhere.
export async function POST(request: Request) {
  const appUserId = getAppUserId(request);
  if (!appUserId) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json().catch(() => ({}));
    const mobile = typeof body?.mobile === 'string' ? body.mobile.trim() : '';
    if (!/^[6-9]\d{9}$/.test(mobile)) {
      return NextResponse.json({ message: 'Enter a valid 10-digit mobile number.' }, { status: 422 });
    }

    const user = await prisma.appUser.findUnique({ where: { id: appUserId }, select: { mobile: true } });
    if (!user) return NextResponse.json({ message: 'User not found' }, { status: 404 });
    if (user.mobile === mobile) {
      return NextResponse.json({ message: 'This is already your mobile number.' }, { status: 400 });
    }

    const key = mobileChangeOtpKey(appUserId, mobile);
    const rateLimit = await checkOtpResendAllowed(key);
    if (!rateLimit.allowed) return NextResponse.json({ message: rateLimit.message }, { status: 429 });

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    await recordOtpSend(key);
    await prisma.appOtp.upsert({
      where: { identifier: key },
      update: { otpHash, expiresAt, attempts: 0 },
      create: { identifier: key, otpHash, expiresAt },
    });

    try {
      // Same registered DLT template the signup OTP uses.
      await sendOtpSms(mobile, otp, 'signup');
      return NextResponse.json({ sentTo: maskMobile(mobile) });
    } catch (e) {
      console.error(`Mobile-change OTP SMS for ${appUserId} failed:`, e);
    }

    // Same dev escape hatch as signup/reset/delete, so local testing isn't blocked.
    if (process.env.NODE_ENV !== 'production') {
      return NextResponse.json({ sentTo: maskMobile(mobile), devOtp: otp });
    }
    return NextResponse.json({ message: 'Could not send the verification code. Please try again.' }, { status: 502 });
  } catch (error) {
    console.error('profile mobile-otp error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
