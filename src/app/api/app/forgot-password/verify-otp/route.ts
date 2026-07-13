import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';

function isEmail(val: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
}

export async function POST(request: Request) {
  try {
    const { identifier, otp } = await request.json();

    if (!identifier || typeof identifier !== 'string' || !otp || typeof otp !== 'string') {
      return NextResponse.json({ message: 'Identifier and OTP are required' }, { status: 400 });
    }

    const id = identifier.trim().toLowerCase();
    const type = isEmail(id) ? 'email' : 'mobile';
    const lookupId = type === 'mobile' ? id.replace(/\D/g, '') : id;

    const record = await prisma.appOtp.findUnique({ where: { identifier: `reset:${lookupId}` } });
    if (!record || !record.otpHash || !record.expiresAt) {
      return NextResponse.json({ message: 'No OTP requested for this contact. Please resend.' }, { status: 400 });
    }
    if (record.expiresAt < new Date()) {
      return NextResponse.json({ message: 'OTP has expired. Please request a new one.' }, { status: 400 });
    }

    const ok = await bcrypt.compare(otp.trim(), record.otpHash);
    if (!ok) {
      return NextResponse.json({ message: 'Incorrect OTP. Please try again.' }, { status: 400 });
    }

    // Single-use: burn the OTP once verified.
    await prisma.appOtp.delete({ where: { identifier: `reset:${lookupId}` } });

    // All accounts registered under this contact (sibling accounts share a phone/email).
    const users = await prisma.appUser.findMany({
      where: type === 'email' ? { email: id } : { mobile: lookupId },
      select: { id: true, userId: true, olympiadId: true },
    });
    if (users.length === 0) {
      return NextResponse.json({ message: 'No account is registered with this email/mobile' }, { status: 404 });
    }

    // Attach the student's name (from the Olympiad ID allocation) for the picker UI.
    const codes = users.map((u) => u.olympiadId).filter((c): c is string => !!c);
    const allocations = codes.length
      ? await prisma.olympiadIdAllocation.findMany({
          where: { code: { in: codes } },
          select: { code: true, assignedName: true },
        })
      : [];
    const nameByCode = new Map(allocations.map((a) => [a.code, a.assignedName]));

    const accounts = users.map((u) => ({
      id: u.id,
      userId: u.userId,
      studentName: (u.olympiadId && nameByCode.get(u.olympiadId)) || null,
    }));

    const resetToken = jwt.sign(
      { purpose: 'app-password-reset', identifier: lookupId, accountIds: users.map((u) => u.id) },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '10m' }
    );

    return NextResponse.json({ resetToken, accounts });
  } catch (error) {
    console.error('forgot-password/verify-otp error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
