import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { generateUserId } from '@/lib/generateUserId';

function isEmail(val: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
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
      return NextResponse.json({ message: 'OTP has expired. Please request a new one.' }, { status: 400 });
    }

    const otpMatch = await bcrypt.compare(otp.trim(), record.otpHash);
    if (!otpMatch) {
      return NextResponse.json({ message: 'Invalid OTP. Please check and try again.' }, { status: 400 });
    }

    // Email still uniquely identifies one account — keep upsert semantics.
    if (!mobile) {
      const userId = await generateUserId(null);
      const passwordHash = await bcrypt.hash(password, 10);

      const user = await prisma.appUser.upsert({
        where: { email: id },
        update: {
          password: passwordHash,
          plainPassword: password,
          isVerified: true,
          termsAccepted: true,
        },
        create: {
          userId,
          email: id,
          mobile: null,
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
    }

    // Mobile can be shared by sibling accounts. If accounts already exist on
    // this mobile, don't silently overwrite one — surface them so the client
    // can offer "log in as one of these" vs. "create a new account".
    const existingAccounts = await prisma.appUser.findMany({
      where: { mobile, isVerified: true },
      select: { id: true, userId: true, olympiadId: true },
    });

    if (existingAccounts.length > 0 && !request.headers.get('x-create-new-account')) {
      const accountsWithNames = await Promise.all(
        existingAccounts.map(async (acc) => {
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

      return NextResponse.json({
        message: 'Accounts already exist for this phone number. Choose one to continue, or create a new account.',
        accounts: accountsWithNames,
      }, { status: 409 });
    }

    const userId = await generateUserId(null);
    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.appUser.create({
      data: {
        userId,
        email: null,
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
