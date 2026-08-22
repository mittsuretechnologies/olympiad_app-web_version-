import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { sendOtpEmail } from '@/lib/mailer';
import { sendOtpSms } from '@/lib/sms';
import { checkOtpResendAllowed, recordOtpSend } from '@/lib/otpRateLimit';

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function isEmail(val: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
}

function isMobile(val: string): boolean {
  return /^[6-9]\d{9}$/.test(val);
}

export async function POST(request: Request) {
  try {
    const { identifier } = await request.json();

    if (!identifier || typeof identifier !== 'string') {
      return NextResponse.json({ message: 'Email or mobile number is required' }, { status: 400 });
    }

    const id = identifier.trim().toLowerCase();
    const type = isEmail(id) ? 'email' : isMobile(id.replace(/\D/g, '')) ? 'mobile' : null;

    if (!type) {
      return NextResponse.json(
        { message: 'Enter a valid email address or 10-digit mobile number' },
        { status: 400 }
      );
    }

    const mobile = type === 'mobile' ? id.replace(/\D/g, '') : null;
    const lookupId = mobile ?? id;

    const accounts = await prisma.appUser.findMany({
      where: type === 'email' ? { email: id } : { mobile },
      select: { id: true },
    });

    // Always respond the same way whether or not an account exists, so this
    // endpoint can't be used to enumerate registered emails/mobiles.
    const genericResponse = { message: 'If an account exists for this contact, an OTP has been sent.', type };
    if (accounts.length === 0) {
      return NextResponse.json(genericResponse);
    }

    // "reset:" prefix keeps password-reset OTPs separate from signup OTPs.
    const otpKey = `reset:${lookupId}`;

    // Checked before the OTP is generated: every send past this point is billed,
    // so an unthrottled endpoint would let a loop drain the SMS account.
    // Throttled requests return the same generic 200 as an unknown contact: a
    // 429 here would only ever fire for accounts that exist, which would undo
    // the enumeration protection above.
    const rateLimit = await checkOtpResendAllowed(otpKey);
    if (!rateLimit.allowed) {
      return NextResponse.json(genericResponse);
    }

    const otp = generateOtp();
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 min
    await recordOtpSend(otpKey);

    await prisma.appOtp.upsert({
      where: { identifier: otpKey },
      update: { otpHash, expiresAt, attempts: 0 },
      create: { identifier: otpKey, otpHash, expiresAt },
    });

    if (type === 'email') {
      try {
        await sendOtpEmail(id, otp, 'reset');
        return NextResponse.json({ ...genericResponse, devOtp: undefined });
      } catch (mailErr) {
        console.error(`Reset OTP email to ${id} failed:`, mailErr);
        if (process.env.NODE_ENV !== 'production') {
          return NextResponse.json({ ...genericResponse, devOtp: otp });
        }
        return NextResponse.json(
          { message: 'Could not send the OTP email. Please try again.' },
          { status: 502 }
        );
      }
    }

    try {
      await sendOtpSms(mobile!, otp, 'reset');
      return NextResponse.json({ ...genericResponse, devOtp: undefined });
    } catch (smsErr) {
      console.error(`Reset OTP SMS to ${lookupId} failed:`, smsErr);
      // In dev, fall back to returning the OTP so testing isn't blocked.
      if (process.env.NODE_ENV !== 'production') {
        return NextResponse.json({ ...genericResponse, devOtp: otp });
      }
      return NextResponse.json(
        { message: 'Could not send the OTP SMS. Please try again.' },
        { status: 502 }
      );
    }
  } catch (error) {
    console.error('forgot-password/request error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
