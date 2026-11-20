import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { inactiveSchoolResponse } from '@/lib/auth-guard';
import { getJwtSecret } from '@/lib/jwt-secret';
import { decryptPassword } from '@/lib/password-crypto';
import { recordAccessLog } from '@/lib/audit-log';
import { sendStudentCredentialsEmail } from '@/lib/mailer';
import { sendStudentCredentialsSms } from '@/lib/sms';

/** Resends allowed per student per rolling 24 hours, from the school panel. */
const MAX_RESENDS_PER_DAY = 3;

/**
 * POST /api/school/me/students/:id/resend-credentials
 * body: { source: 'app' | 'web', channel: 'sms' | 'email' }
 *
 * Re-sends one of the school's students their Olympiad ID, username and
 * password, by SMS or email, on the same templates used at allotment.
 *
 * Why this is safe where the old send-credentials route was not (that one is
 * still disabled, see olympiad-ids/[code]/send-credentials): the credentials go
 * only to the phone number / email already saved on the student's account, never to
 * an address the school types, and they are never in the response. The school
 * sees only "sent to …".
 *
 * An app account whose student has set their own password (mustChangePassword
 * is false) is refused: the school edits a student's contact details elsewhere,
 * so it could otherwise point the phone at itself and receive the student's
 * private password. Such a student uses "Forgot password" in the app instead.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = request.headers.get('authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    let payload: any;
    try { payload = jwt.verify(token, getJwtSecret()); }
    catch { return NextResponse.json({ message: 'Invalid token' }, { status: 401 }); }
    if (payload?.role !== 'SCHOOL' || !payload?.id) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }
    const blocked = await inactiveSchoolResponse(payload.id);
    if (blocked) return blocked;

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const source: 'web' | 'app' = body?.source === 'app' ? 'app' : 'web';
    const channel = body?.channel;
    if (channel !== 'sms' && channel !== 'email') {
      return NextResponse.json({ message: 'Choose SMS or email' }, { status: 400 });
    }

    let target: {
      name: string; phone: string | null; email: string | null;
      olympiadId: string; username: string | null; password: string | null;
    };

    if (source === 'app') {
      const appUser = await prisma.appUser.findUnique({
        where: { id },
        select: { userId: true, mobile: true, email: true, olympiadId: true, plainPassword: true, mustChangePassword: true, isVerified: true },
      });
      if (!appUser?.olympiadId || !appUser.isVerified) return NextResponse.json({ message: 'Student not found' }, { status: 404 });
      const allocation = await prisma.olympiadIdAllocation.findUnique({
        where: { code: appUser.olympiadId },
        select: { schoolId: true, assignedName: true },
      });
      if (!allocation || allocation.schoolId !== payload.id) {
        return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
      }
      if (!appUser.mustChangePassword) {
        return NextResponse.json(
          { message: 'This student has already set their own password, so it can no longer be sent from the school panel. Ask them to use "Forgot password" in the app.' },
          { status: 409 },
        );
      }
      target = {
        name: allocation.assignedName || appUser.userId,
        phone: appUser.mobile,
        email: appUser.email,
        olympiadId: appUser.olympiadId,
        username: appUser.userId,
        password: decryptPassword(appUser.plainPassword),
      };
    } else {
      const student = await prisma.student.findUnique({
        where: { id },
        select: {
          name: true, phone: true, olympiadCode: true, username: true, plainPassword: true, isVerified: true,
          allocation: { select: { schoolId: true } },
        },
      });
      if (!student || !student.isVerified) return NextResponse.json({ message: 'Student not found' }, { status: 404 });
      if (student.allocation?.schoolId !== payload.id) {
        return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
      }
      target = {
        name: student.name,
        phone: student.phone,
        email: null, // web Student rows carry no email
        olympiadId: student.olympiadCode,
        username: student.username,
        password: decryptPassword(student.plainPassword),
      };
    }

    if (!target.username || !target.password) {
      return NextResponse.json({ message: 'No saved login for this student. Please contact the Olympiad admin.' }, { status: 400 });
    }
    const phone = (target.phone || '').replace(/\D/g, '');
    if (channel === 'sms' && phone.length < 10) {
      return NextResponse.json({ message: 'No phone number saved for this student' }, { status: 400 });
    }
    if (channel === 'email' && !target.email) {
      return NextResponse.json({ message: 'No email saved for this student' }, { status: 400 });
    }

    // Keeps a school from flooding a student (and the SMS bill) with resends.
    const recent = await prisma.auditLog.count({
      where: {
        action: 'CREDENTIALS_SENT', actorId: payload.id,
        entityType: source === 'app' ? 'AppUser' : 'Student', entityId: id,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });
    if (recent >= MAX_RESENDS_PER_DAY) {
      return NextResponse.json(
        { message: `Credentials were already sent ${recent} times in the last 24 hours. Please try again later.` },
        { status: 429 },
      );
    }

    const sentTo = channel === 'sms' ? phone : target.email!;
    try {
      if (channel === 'sms') {
        await sendStudentCredentialsSms(phone, {
          studentName: target.name,
          olympiadId: target.olympiadId,
          username: target.username,
          password: target.password,
        });
      } else {
        const school = await prisma.school.findUnique({ where: { id: payload.id }, select: { name: true } });
        await sendStudentCredentialsEmail({
          to: target.email!,
          studentName: target.name,
          schoolName: school?.name,
          olympiadCode: target.olympiadId,
          userId: target.username,
          password: target.password,
        });
      }
    } catch (sendErr: any) {
      console.error(`School resend of student credentials by ${channel} to ${sentTo} failed:`, sendErr);
      return NextResponse.json(
        { message: channel === 'sms' ? 'Could not send the SMS. Please try again.' : 'Could not send the email. Please try again.' },
        { status: 502 },
      );
    }

    await recordAccessLog(payload, {
      action: 'CREDENTIALS_SENT', entityType: source === 'app' ? 'AppUser' : 'Student', subjectIds: [id], request,
      details: { method: channel, sentTo, by: 'school-panel' },
    });
    return NextResponse.json({ success: true, channel, sentTo });
  } catch (error) {
    console.error('POST school students/[id]/resend-credentials failed:', error);
    return NextResponse.json({ message: 'Failed to send credentials' }, { status: 500 });
  }
}
