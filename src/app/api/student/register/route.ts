import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { otpStore } from '@/lib/otpStore';

export async function POST(request: Request) {
  try {
    const { olympiadCode, name, phone } = await request.json();

    if (!olympiadCode || !name || !phone) {
      return NextResponse.json(
        { message: 'Olympiad ID, name and phone are required' },
        { status: 400 }
      );
    }

    // Check Olympiad ID exists and is not already registered
    const allocation = await prisma.olympiadIdAllocation.findUnique({
      where: { code: olympiadCode.trim() },
      include: { student: true },
    });

    if (!allocation) {
      return NextResponse.json({ message: 'Invalid Olympiad ID' }, { status: 404 });
    }
    if (allocation.student) {
      return NextResponse.json({ message: 'This Olympiad ID is already registered' }, { status: 409 });
    }

    // Generate 6-digit OTP
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const expires = Date.now() + 5 * 60 * 1000; // 5 min

    otpStore.set(olympiadCode.trim(), { otp, expires, name: name.trim(), phone: phone.trim() });

    // TODO: Send real SMS here (Twilio/MSG91)
    console.log(`[OTP] Code: ${olympiadCode} | Name: ${name} | Phone: ${phone} | OTP: ${otp}`);

    return NextResponse.json({
      message: 'OTP sent to your phone number',
      // Remove this in production:
      ...(process.env.NODE_ENV === 'development' ? { devOtp: otp } : {}),
    });
  } catch (error) {
    console.error('POST student/register failed:', error);
    return NextResponse.json({ message: 'Failed to initiate registration' }, { status: 500 });
  }
}

