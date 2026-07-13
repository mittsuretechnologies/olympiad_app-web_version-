import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { sendResetOtp } from '@/lib/resetOtp';

function maskEmail(email: string): string {
  const [user, domain] = email.split('@');
  if (!domain) return email;
  const visible = user.slice(0, 2);
  return `${visible}${'*'.repeat(Math.max(user.length - 2, 1))}@${domain}`;
}

function maskPhone(phone: string): string {
  if (phone.length <= 4) return phone;
  return `${'*'.repeat(phone.length - 4)}${phone.slice(-4)}`;
}

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

    const school = await prisma.school.findUnique({
      where: { id: payload.id },
      select: { id: true, email: true, phone: true },
    });
    if (!school) return NextResponse.json({ message: 'School not found' }, { status: 404 });

    const channel: 'email' | 'phone' | null = school.email ? 'email' : school.phone ? 'phone' : null;
    if (!channel) {
      return NextResponse.json(
        { message: 'No contact info on file. Contact admin to add an email or phone number.' },
        { status: 400 }
      );
    }

    const identifier = `school-visibility:${school.id}`;
    const result = await sendResetOtp(identifier);
    if (!result.ok) {
      return NextResponse.json({ message: result.message }, { status: result.status });
    }

    const masked = channel === 'email' ? maskEmail(school.email!) : maskPhone(school.phone!);

    return NextResponse.json({
      message: `OTP sent to your registered ${channel} (${masked}).`,
      channel,
      devOtp: result.devOtp,
    });
  } catch (error) {
    console.error('school video-visibility request-otp error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
