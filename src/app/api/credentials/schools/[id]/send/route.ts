import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendSchoolCredentialsEmail } from '@/lib/mailer';
import { sendCredentialsSms } from '@/lib/sms';
import { requireAdmin } from '@/lib/auth-guard';
import { decryptPassword } from '@/lib/password-crypto';
import { recordAccessLog } from '@/lib/audit-log';

// POST /api/credentials/schools/:id/send — body: { method: 'sms' | 'email' }
// Sends the school's current username + password via SMS or email.
// Email goes out over real SMTP (see src/lib/mailer.ts). SMS goes via the
// DLT-approved credentials template (see src/lib/sms.ts).
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, payload } = await requireAdmin(request, 'credentials.schools');
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
          username: school.username,
          password: decryptPassword(school.plainPassword)!,
        });
      } catch (mailErr: any) {
        console.error(`Credentials email to ${school.email} failed:`, mailErr);
        return NextResponse.json({ message: mailErr?.message || 'Failed to send email' }, { status: 502 });
      }
    } else {
      try {
        await sendCredentialsSms(school.phone!, {
          schoolName: school.name,
          username: school.username,
          password: decryptPassword(school.plainPassword)!,
        });
      } catch (smsErr: any) {
        console.error(`Credentials SMS to ${school.phone} failed:`, smsErr);
        return NextResponse.json({ message: smsErr?.message || 'Failed to send SMS' }, { status: 502 });
      }
    }

    const sentTo = method === 'sms' ? school.phone : school.email;
    await recordAccessLog(payload, {
      action: 'CREDENTIALS_SENT', entityType: 'School', subjectIds: [id], request,
      details: { method, sentTo },
    });
    return NextResponse.json({ success: true, method, sentTo });
  } catch (error) {
    console.error('POST credentials/schools/[id]/send failed:', error);
    return NextResponse.json({ message: 'Failed to send credentials' }, { status: 500 });
  }
}
