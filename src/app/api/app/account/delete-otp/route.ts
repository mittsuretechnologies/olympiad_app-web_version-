import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { verify } from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { getJwtSecret } from '@/lib/jwt-secret';
import { sendOtpEmail } from '@/lib/mailer';
import { sendOtpSms } from '@/lib/sms';
import { checkOtpResendAllowed, recordOtpSend } from '@/lib/otpRateLimit';
import { deletionOtpKey } from '@/lib/deletionOtp';

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
const maskEmail = (e: string) => {
  const [name, domain] = e.split('@');
  return `${name.slice(0, 1)}${'*'.repeat(Math.max(2, name.length - 1))}@${domain}`;
};

// POST /api/app/account/delete-otp — sends a 6-digit code to the account's
// registered phone (SMS), or to its email when there is no phone or the SMS
// fails. The code is required by POST /api/app/account/delete-request, so a
// stolen or left-logged-in session alone can't delete the account.
export async function POST(request: Request) {
  const appUserId = getAppUserId(request);
  if (!appUserId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const user = await prisma.appUser.findUnique({
      where: { id: appUserId },
      select: { mobile: true, email: true },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const mobile = user.mobile && /^[6-9]\d{9}$/.test(user.mobile) ? user.mobile : null;
    const email = user.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email) ? user.email : null;
    if (!mobile && !email) {
      return NextResponse.json(
        { error: 'No phone number or email is registered on this account. Please contact Help & Support to delete it.' },
        { status: 400 },
      );
    }

    const key = deletionOtpKey(appUserId);
    const rateLimit = await checkOtpResendAllowed(key);
    if (!rateLimit.allowed) return NextResponse.json({ error: rateLimit.message }, { status: 429 });

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    await recordOtpSend(key);
    await prisma.appOtp.upsert({
      where: { identifier: key },
      update: { otpHash, expiresAt, attempts: 0 },
      create: { identifier: key, otpHash, expiresAt },
    });

    if (mobile) {
      try {
        await sendOtpSms(mobile, otp, 'delete');
        return NextResponse.json({ channel: 'sms', sentTo: maskMobile(mobile) });
      } catch (e) {
        console.error(`Deletion OTP SMS for ${appUserId} failed:`, e);
      }
    }
    if (email) {
      try {
        await sendOtpEmail(email, otp, 'delete');
        return NextResponse.json({ channel: 'email', sentTo: maskEmail(email) });
      } catch (e) {
        console.error(`Deletion OTP email for ${appUserId} failed:`, e);
      }
    }

    // Same dev escape hatch as signup/reset, so local testing isn't blocked.
    if (process.env.NODE_ENV !== 'production') {
      return NextResponse.json({ channel: mobile ? 'sms' : 'email', sentTo: mobile ? maskMobile(mobile) : maskEmail(email!), devOtp: otp });
    }
    return NextResponse.json({ error: 'Could not send the verification code. Please try again.' }, { status: 502 });
  } catch (error) {
    console.error('account delete-otp error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
