import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { generateUserId } from '@/lib/generateUserId';

const MAX_APP_OTP_ATTEMPTS = 5;

function isEmail(val: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
}

async function withStudentNames(accounts: { id: string; userId: string; olympiadId: string | null }[]) {
  return Promise.all(
    accounts.map(async (acc) => {
      let studentName: string | null = null;
      if (acc.olympiadId) {
        const allocation = await prisma.olympiadIdAllocation.findUnique({
          where: { code: acc.olympiadId },
          select: { assignedName: true, student: { select: { name: true } } },
        });
        studentName = allocation?.student?.name ?? allocation?.assignedName ?? null;
      }
      return { id: acc.id, userId: acc.userId, studentName };
    })
  );
}

export async function POST(request: Request) {
  try {
    const { identifier, otp, password } = await request.json();

    if (!identifier || !otp || !password) {
      return NextResponse.json({ message: 'All fields are required' }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ message: 'Password must be at least 6 characters' }, { status: 400 });
    }

    const id = identifier.trim().toLowerCase();
    const mobile = !isEmail(id) ? id.replace(/\D/g, '') : null;
    const lookupId = mobile ?? id;

    const record = await prisma.appOtp.findUnique({ where: { identifier: lookupId } });
    if (!record) {
      return NextResponse.json({ message: 'No OTP was sent to this contact. Please request a new OTP.' }, { status: 400 });
    }
    if (record.expiresAt < new Date()) {
      await prisma.appOtp.delete({ where: { identifier: lookupId } }).catch(() => {});
      return NextResponse.json({ message: 'OTP has expired. Please request a new one.' }, { status: 400 });
    }
    if (record.attempts >= MAX_APP_OTP_ATTEMPTS) {
      await prisma.appOtp.delete({ where: { identifier: lookupId } }).catch(() => {});
      return NextResponse.json({ message: 'Too many incorrect attempts. Please request a new OTP.' }, { status: 429 });
    }

    const otpMatch = await bcrypt.compare(otp.trim(), record.otpHash);
    if (!otpMatch) {
      await prisma.appOtp.update({
        where: { identifier: lookupId },
        data: { attempts: { increment: 1 } },
      }).catch(() => {});
      return NextResponse.json({ message: 'Invalid OTP. Please check and try again.' }, { status: 400 });
    }

    // Email and mobile can both be shared by sibling accounts. If accounts
    // already exist on this contact, don't silently overwrite one — surface
    // them so the client can offer "log in as one of these" vs. "create a
    // new account".
    const contactWhere = mobile ? { mobile } : { email: id };
    const existingAccounts = await prisma.appUser.findMany({
      where: { ...contactWhere, isVerified: true },
      select: { id: true, userId: true, olympiadId: true },
    });

    if (existingAccounts.length > 0 && !request.headers.get('x-create-new-account')) {
      return NextResponse.json({
        message: `Accounts already exist for this ${mobile ? 'phone number' : 'email'}. Choose one to continue, or create a new account.`,
        accounts: await withStudentNames(existingAccounts),
      }, { status: 409 });
    }

    const userId = await generateUserId(null);
    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.appUser.create({
      data: {
        userId,
        email: mobile ? null : id,
        mobile,
        password: passwordHash,
        plainPassword: password,
        isVerified: true,
        termsAccepted: true,
      },
    });

    await prisma.appOtp.delete({ where: { identifier: lookupId } }).catch(() => {});

    const token = jwt.sign(
      { id: user.id, userId: user.userId, role: 'APP_USER' },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '30d' }
    );

    return NextResponse.json({
      message: 'Registration successful',
      token,
      user: {
        id: user.id,
        userId: user.userId,
        email: user.email,
        mobile: user.mobile,
      },
    });
  } catch (error) {
    console.error('verify-otp-register error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
