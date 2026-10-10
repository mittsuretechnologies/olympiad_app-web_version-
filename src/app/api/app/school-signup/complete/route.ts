import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { generateUserId } from '@/lib/generateUserId';
import { getJwtSecret } from '@/lib/jwt-secret';
import { STATES } from '@/lib/locations';
import {
  SCHOOL_AGREEMENT_KEY,
  SCHOOL_AGREEMENT_VERSION,
  schoolAgreementDeclarations,
} from '@/lib/agreements/school-onboarding';
import { clientIp, userAgent, schoolAgreementHash, normaliseMobile, isEmail } from '@/lib/agreements/server';
import {
  ACCOUNT_TYPE_SCHOOL,
  GENERAL_SCHOOL_AGREEMENT_ROLE,
  generalSchoolDetailsSnapshot,
  plausibleDate,
} from '@/lib/generalSchool';

export const dynamic = 'force-dynamic';

const MAX_APP_OTP_ATTEMPTS = 5;

// POST /api/app/school-signup/complete
//
// Creates a General School in one step, after the app has collected the
// school details, the mobile OTP, the new password and the agreement
// acceptance. Everything is created in a single transaction so a school can
// never end up half-registered (account without an agreement, or the reverse).
//
// The OTP is the one issued by /api/app/send-otp for the mobile number, and is
// checked here exactly like /api/app/verify-otp-register does for users.
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) return NextResponse.json({ message: 'Invalid request' }, { status: 400 });

    const schoolName = typeof body.schoolName === 'string' ? body.schoolName.trim().replace(/\s+/g, ' ') : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const mobile = normaliseMobile(body.mobile);
    const otp = typeof body.otp === 'string' ? body.otp.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const stateIn = typeof body.state === 'string' ? body.state.trim() : '';
    const districtIn = typeof body.district === 'string' ? body.district.trim() : '';
    const contactPerson = typeof body.contactPerson === 'string' && body.contactPerson.trim() ? body.contactPerson.trim().slice(0, 100) : null;
    const city = typeof body.city === 'string' && body.city.trim() ? body.city.trim().slice(0, 100) : null;
    const pincode = typeof body.pincode === 'string' && body.pincode.trim() ? body.pincode.trim() : null;
    const address = typeof body.address === 'string' && body.address.trim() ? body.address.trim().slice(0, 300) : null;

    if (schoolName.length < 3 || schoolName.length > 120) {
      return NextResponse.json({ message: 'Enter the full school name (3 to 120 characters)' }, { status: 400 });
    }
    if (!isEmail(email)) {
      return NextResponse.json({ message: 'A valid email address is required' }, { status: 400 });
    }
    if (!mobile) {
      return NextResponse.json({ message: 'A valid 10-digit mobile number is required' }, { status: 400 });
    }
    if (!/^\d{6}$/.test(otp)) {
      return NextResponse.json({ message: 'Enter the 6-digit OTP' }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ message: 'Password must be at least 6 characters' }, { status: 400 });
    }
    if (pincode && !/^\d{6}$/.test(pincode)) {
      return NextResponse.json({ message: 'Pincode must be 6 digits' }, { status: 400 });
    }

    // State and district must come from the known list - they feed the school's
    // auto hashtags and the admin filters, so free text would fragment them.
    const stateDef = STATES.find(s => s.name.toLowerCase() === stateIn.toLowerCase());
    if (!stateDef) return NextResponse.json({ message: 'Select your state' }, { status: 400 });
    const districtDef = stateDef.districts.find(d => d.name.toLowerCase() === districtIn.toLowerCase());
    if (!districtDef) return NextResponse.json({ message: 'Select your district' }, { status: 400 });

    // Agreement: the same document and the same four declarations an Olympiad
    // school accepts. Never record an acceptance against wording the school did
    // not see, and never without every box ticked.
    const agreement = body.agreement;
    if (!agreement || agreement.documentVersion !== SCHOOL_AGREEMENT_VERSION) {
      return NextResponse.json(
        { message: 'The agreement has been updated. Please go back and read the latest version.' },
        { status: 409 },
      );
    }
    const declarations = schoolAgreementDeclarations();
    if (
      !Array.isArray(agreement.declarations) ||
      agreement.declarations.length !== declarations.length ||
      !agreement.declarations.every((d: unknown) => d === true)
    ) {
      return NextResponse.json({ message: 'Please tick all the declarations to accept the agreement.' }, { status: 400 });
    }

    // One General School per mobile and per email. (Ordinary users may share
    // contacts across sibling accounts; a school identity should not.)
    const duplicate = await prisma.generalSchool.findFirst({
      where: { OR: [{ mobile }, { email: { equals: email, mode: 'insensitive' } }] },
      select: { mobile: true },
    });
    if (duplicate) {
      return NextResponse.json(
        { message: 'A school is already registered with this mobile number or email. Please log in instead.' },
        { status: 409 },
      );
    }

    // ---- OTP (issued by /api/app/send-otp for the mobile number) ----
    const record = await prisma.appOtp.findUnique({ where: { identifier: mobile } });
    if (!record) {
      return NextResponse.json({ message: 'No OTP was sent to this number. Please request a new OTP.' }, { status: 400 });
    }
    if (record.expiresAt < new Date()) {
      await prisma.appOtp.delete({ where: { identifier: mobile } }).catch(() => {});
      return NextResponse.json({ message: 'OTP has expired. Please request a new one.' }, { status: 400 });
    }
    if (record.attempts >= MAX_APP_OTP_ATTEMPTS) {
      await prisma.appOtp.delete({ where: { identifier: mobile } }).catch(() => {});
      return NextResponse.json({ message: 'Too many incorrect attempts. Please request a new OTP.' }, { status: 429 });
    }
    const otpMatch = await bcrypt.compare(otp, record.otpHash);
    if (!otpMatch) {
      await prisma.appOtp.update({ where: { identifier: mobile }, data: { attempts: { increment: 1 } } }).catch(() => {});
      return NextResponse.json({ message: 'Invalid OTP. Please check and try again.' }, { status: 400 });
    }

    // ---- Create everything atomically ----
    const userId = await generateUserId(schoolName);
    const passwordHash = await bcrypt.hash(password, 10);
    const now = new Date();

    const { user, school } = await prisma.$transaction(async (tx) => {
      const user = await tx.appUser.create({
        data: {
          userId,
          email,
          mobile,
          password: passwordHash,
          isVerified: true,
          accountType: ACCOUNT_TYPE_SCHOOL,
          // The Terms were accepted as part of the agreement below.
          termsAccepted: true,
          termsAcceptedAt: now,
        },
      });
      const school = await tx.generalSchool.create({
        data: {
          appUserId: user.id,
          name: schoolName,
          email,
          mobile,
          contactPerson,
          state: stateDef.name,
          district: districtDef.name,
          city,
          pincode,
          address,
        },
      });
      await tx.agreementAcceptance.create({
        data: {
          role: GENERAL_SCHOOL_AGREEMENT_ROLE,
          actorId: school.id,
          actorCode: userId,
          actorName: schoolName,
          documentKey: SCHOOL_AGREEMENT_KEY,
          documentVersion: SCHOOL_AGREEMENT_VERSION,
          documentHash: schoolAgreementHash(),
          signatoryName: contactPerson || schoolName,
          signatoryDesignation: 'Authorised Representative (accepted in the Mittmee app during sign-up)',
          signatoryPhone: mobile,
          details: generalSchoolDetailsSnapshot({
            name: schoolName, email, mobile, state: stateDef.name, district: districtDef.name,
            city, pincode, address, userId,
          }),
          declarations,
          // The mobile number was verified by OTP moments ago in this same flow.
          verificationChannel: 'SMS_OTP',
          verificationTarget: mobile,
          verifiedAt: now,
          ipAddress: clientIp(request),
          userAgent: userAgent(request),
          readStartedAt: plausibleDate(agreement.readStartedAt),
          readCompletedAt: plausibleDate(agreement.readCompletedAt),
          acceptedAt: now,
        },
      });
      return { user, school };
    });

    await prisma.appOtp.delete({ where: { identifier: mobile } }).catch(() => {});

    const token = jwt.sign(
      { id: user.id, userId: user.userId, role: 'APP_USER' },
      getJwtSecret(),
      { expiresIn: '30d' },
    );

    return NextResponse.json({
      message: 'School registered',
      token,
      user: {
        id: user.id,
        userId: user.userId,
        email: user.email,
        mobile: user.mobile,
        avatarUrl: null,
        olympiadId: null,
        isPrivate: false,
        termsAccepted: true,
        mustChangePassword: false,
        accountType: ACCOUNT_TYPE_SCHOOL,
        schoolProfile: {
          id: school.id, name: school.name, state: school.state, district: school.district,
          agreementAccepted: true,
        },
      },
    }, { status: 201 });
  } catch (error: any) {
    console.error('school-signup/complete error:', error);
    // A parallel request for the same contact can slip past the duplicate check;
    // map a unique-constraint race to the same friendly message.
    if (error?.code === 'P2002') {
      return NextResponse.json({ message: 'This school is already registered. Please log in.' }, { status: 409 });
    }
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
