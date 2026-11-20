import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendStudentCredentialsSms } from '@/lib/sms';
import { requireAdmin } from '@/lib/auth-guard';
import { decryptPassword } from '@/lib/password-crypto';
import { recordAccessLog } from '@/lib/audit-log';

// POST /api/credentials/students/:id/send — body: { source: 'app' | 'web' }
// Re-sends a student's current Olympiad ID, username and password by SMS on
// the DLT-approved student credentials template — the same message the school
// panel sends at allotment (see src/lib/sms.ts). `id` is an AppUser.id for
// app accounts and a Student.id for web ones, as listed by GET ../students.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, payload } = await requireAdmin(request, 'credentials.students');
  if (error) return error;
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const source: 'web' | 'app' = body?.source === 'app' ? 'app' : 'web';

    let target: { name: string; phone: string | null; olympiadId: string | null; username: string | null; password: string | null };

    if (source === 'app') {
      const appUser = await prisma.appUser.findUnique({
        where: { id },
        select: { userId: true, mobile: true, olympiadId: true, plainPassword: true },
      });
      if (!appUser) return NextResponse.json({ message: 'Student not found' }, { status: 404 });
      // Same name the credentials list shows: the school's entry, else the userId.
      const allocation = appUser.olympiadId
        ? await prisma.olympiadIdAllocation.findUnique({ where: { code: appUser.olympiadId }, select: { assignedName: true } })
        : null;
      target = {
        name: allocation?.assignedName || appUser.userId,
        phone: appUser.mobile,
        olympiadId: appUser.olympiadId,
        username: appUser.userId,
        password: decryptPassword(appUser.plainPassword),
      };
    } else {
      const student = await prisma.student.findUnique({
        where: { id },
        select: { name: true, phone: true, olympiadCode: true, username: true, plainPassword: true },
      });
      if (!student) return NextResponse.json({ message: 'Student not found' }, { status: 404 });
      target = {
        name: student.name,
        phone: student.phone,
        olympiadId: student.olympiadCode,
        username: student.username,
        password: decryptPassword(student.plainPassword),
      };
    }

    if (!target.olympiadId) return NextResponse.json({ message: 'No Olympiad ID linked to this student' }, { status: 400 });
    if (!target.username) return NextResponse.json({ message: 'No username on file for this student' }, { status: 400 });
    if (!target.password) return NextResponse.json({ message: 'No saved password — set a password before sending' }, { status: 400 });
    if (!target.phone || target.phone === '-') return NextResponse.json({ message: 'No phone number on file for this student' }, { status: 400 });

    try {
      await sendStudentCredentialsSms(target.phone, {
        studentName: target.name,
        olympiadId: target.olympiadId,
        username: target.username,
        password: target.password,
      });
    } catch (smsErr: any) {
      console.error(`Student credentials SMS to ${target.phone} failed:`, smsErr);
      return NextResponse.json({ message: smsErr?.message || 'Failed to send SMS' }, { status: 502 });
    }

    await recordAccessLog(payload, {
      action: 'CREDENTIALS_SENT', entityType: source === 'app' ? 'AppUser' : 'Student', subjectIds: [id], request,
      details: { method: 'sms', sentTo: target.phone },
    });
    return NextResponse.json({ success: true, method: 'sms', sentTo: target.phone });
  } catch (error) {
    console.error('POST credentials/students/[id]/send failed:', error);
    return NextResponse.json({ message: 'Failed to send credentials' }, { status: 500 });
  }
}
