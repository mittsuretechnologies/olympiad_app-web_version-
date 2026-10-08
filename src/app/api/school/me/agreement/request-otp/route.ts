import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth-guard';
import { getJwtSecret } from '@/lib/jwt-secret';
import { issueOtp } from '@/lib/resetOtp';
import { sendAgreementOtpEmail } from '@/lib/mailer';
import { sendOtpSms } from '@/lib/sms';
import { SCHOOL_AGREEMENT_TITLE } from '@/lib/agreements/school-onboarding';
import { agreementOtpIdentifier, maskEmail, maskPhone, otpTargets } from '@/lib/agreements/server';

const TICKET_TTL_SECONDS = 15 * 60;

// Step (b) of Section 18.2 — "verifies the acceptance". Delivers a 6-digit
// OTP to the school's registered email (preferred) or mobile as a fallback.
// Returns a short-lived signed ticket recording where the code actually went,
// which the accept call stores as the verification evidence.
export async function POST(request: Request) {
  const { payload, error } = requireRole(request, ['SCHOOL']);
  if (error) return error;

  try {
    const school = await prisma.school.findUnique({
      where: { id: payload.id },
      select: { id: true, name: true, email: true, phone: true },
    });
    if (!school) return NextResponse.json({ message: 'School not found' }, { status: 404 });

    const targets = otpTargets(school);
    if (!targets.email && !targets.phone) {
      return NextResponse.json({ message: 'No email or mobile number is available to send the verification code to.' }, { status: 400 });
    }

    const issued = await issueOtp(agreementOtpIdentifier(school.id, targets.email));
    if (!issued.ok) return NextResponse.json({ message: issued.message }, { status: issued.status });

    let channel: string | null = null;
    let target: string | null = null;
    let sentTo: string | null = null;

    if (targets.email) {
      try {
        await sendAgreementOtpEmail({
          to: targets.email,
          otp: issued.otp,
          schoolName: school.name,
          signatoryName: 'Your Authorised Representative',
          agreementTitle: SCHOOL_AGREEMENT_TITLE,
        });
        channel = 'EMAIL_OTP'; target = targets.email; sentTo = `email ${maskEmail(targets.email)}`;
      } catch (err) {
        console.error('Agreement OTP email failed:', err);
      }
    }
    if (!channel && targets.phone) {
      try {
        await sendOtpSms(targets.phone, issued.otp, 'signup');
        channel = 'SMS_OTP'; target = targets.phone; sentTo = `mobile ${maskPhone(targets.phone)}`;
      } catch (err) {
        console.error('Agreement OTP SMS failed:', err);
      }
    }

    let devOtp: string | undefined;
    if (!channel) {
      // Local dev without SMTP/SMS: hand the code back so the flow is testable.
      // Never in production — there an undelivered code is a hard failure.
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ message: "We couldn't send the verification code. Please try again in a minute or contact support." }, { status: 502 });
      }
      channel = 'DEV_OTP'; target = targets.email ?? targets.phone; sentTo = 'the developer console';
      devOtp = issued.otp;
    }

    const ticket = jwt.sign(
      { sub: school.id, purpose: 'SCHOOL_AGREEMENT_OTP', channel, target, email: targets.email },
      getJwtSecret(),
      { expiresIn: TICKET_TTL_SECONDS },
    );

    return NextResponse.json({ message: `Verification code sent to your registered ${sentTo}.`, sentTo, ticket, devOtp });
  } catch (err) {
    console.error('POST school/me/agreement/request-otp failed:', err);
    return NextResponse.json({ message: 'Could not send the verification code.' }, { status: 500 });
  }
}
