import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST /api/credentials/schools/:id/send — body: { method: 'sms' | 'email' }
// Sends the school's current username + password via SMS or email.
// TODO: wire up a real SMS gateway (e.g. MSG91/Twilio) and email provider
// (e.g. SES/Resend) here — this currently just simulates a successful send.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { method } = await request.json().catch(() => ({}));

    if (method !== 'sms' && method !== 'email') {
      return NextResponse.json({ message: 'method must be "sms" or "email"' }, { status: 400 });
    }

    const school = await prisma.school.findUnique({
      where: { id },
      select: { name: true, username: true, plainPassword: true, phone: true, email: true },
    });
    if (!school) {
      return NextResponse.json({ message: 'School not found' }, { status: 404 });
    }
    if (!school.username || !school.plainPassword) {
      return NextResponse.json({ message: 'Set a password before sending credentials' }, { status: 400 });
    }
    if (method === 'sms' && !school.phone) {
      return NextResponse.json({ message: 'No phone number on file for this school' }, { status: 400 });
    }
    if (method === 'email' && !school.email) {
      return NextResponse.json({ message: 'No email on file for this school' }, { status: 400 });
    }

    // Hardcoded/simulated send — no real gateway call yet.
    console.log(`[credentials-send:${method}] to ${method === 'sms' ? school.phone : school.email} — username=${school.username}`);

    return NextResponse.json({
      success: true,
      method,
      sentTo: method === 'sms' ? school.phone : school.email,
    });
  } catch (error) {
    console.error('POST credentials/schools/[id]/send failed:', error);
    return NextResponse.json({ message: 'Failed to send credentials' }, { status: 500 });
  }
}
