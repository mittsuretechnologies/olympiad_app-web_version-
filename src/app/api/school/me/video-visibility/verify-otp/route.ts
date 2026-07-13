import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { verifyResetOtp } from '@/lib/resetOtp';

const STEP_UP_TTL_SECONDS = 15 * 60; // 15 min

export async function POST(request: Request) {
  try {
    const auth = request.headers.get('authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    let payload: any;
    try { payload = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret'); }
    catch { return NextResponse.json({ message: 'Invalid token' }, { status: 401 }); }
    if (payload?.role !== 'SCHOOL' || !payload?.id)
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });

    const { otp } = await request.json();
    if (!otp) return NextResponse.json({ message: 'OTP is required' }, { status: 400 });

    const school = await prisma.school.findUnique({ where: { id: payload.id }, select: { id: true } });
    if (!school) return NextResponse.json({ message: 'School not found' }, { status: 404 });

    const identifier = `school-visibility:${school.id}`;
    const verified = await verifyResetOtp(identifier, otp);
    if (!verified.ok) {
      return NextResponse.json({ message: verified.message }, { status: verified.status });
    }

    const stepUpToken = jwt.sign(
      { schoolId: school.id, role: 'SCHOOL_VIDEO_VISIBILITY' },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: STEP_UP_TTL_SECONDS }
    );

    return NextResponse.json({
      message: 'Verified successfully.',
      stepUpToken,
      expiresIn: STEP_UP_TTL_SECONDS,
    });
  } catch (error) {
    console.error('school video-visibility verify-otp error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
