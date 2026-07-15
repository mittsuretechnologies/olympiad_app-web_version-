import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendSchoolCredentialsEmail } from '@/lib/mailer';
import { requireRole } from '@/lib/auth-guard';

// POST /api/credentials/schools/:id/send — body: { method: 'sms' | 'email' }
// Sends the school's current username + password via SMS or email.
// Email goes out over real SMTP (see src/lib/mailer.ts). SMS still needs a
// gateway (e.g. MSG91/Twilio) wired up — no provider is configured yet.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = requireRole(request, ['SUPERADMIN']);
  if (error) return error;
  try {
    const { id } = await params;
    const { method } = await request.json().catch(() => ({}));

    if (method !== 'sms' && method !== 'email') {
      return NextResponse.json({ message: 'method must be "sms" or "email"' }, { status: 400 });
    }

    const school = await prisma.school.findUnique({
      where: { id },
      select: { schoolId: true, name: true, username: true, plainPassword: true, phone: true, email: true, contactPerson: true },
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

    if (method === 'email') {
      try {
        await sendSchoolCredentialsEmail({
          to: school.email!,
          schoolName: school.name,
          schoolId: school.schoolId,
          username: school.username,
          password: school.plainPassword,
          contactPerson: school.contactPerson,
        });
      } catch (mailErr: any) {
        console.error(`Credentials email to ${school.email} failed:`, mailErr);
        return NextResponse.json({ message: mailErr?.message || 'Failed to send email' }, { status: 502 });
      }
    } else {
      // SMS gateway not configured — log for now instead of a silent no-op.
      console.log(`[credentials-send:sms] to ${school.phone} — username=${school.username} (no SMS gateway configured)`);
      return NextResponse.json({ message: 'SMS sending is not configured yet' }, { status: 501 });
    }

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
