import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { getJwtSecret } from '@/lib/jwt-secret';
import { recordAuditLog } from '@/lib/audit-log';

// GET  -> the school's own profile (read-only fields + examDate).
// PATCH -> the one field a school may self-edit: examDate. SuperAdmin does not
//          make this mandatory at registration, so a school without one sets
//          it here; one already set can be corrected the same way, up until
//          attendance has been submitted for it (after that the date is what
//          attendance was actually marked against, so it's frozen).

function getSchoolPayload(request: Request) {
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  try {
    const payload: any = jwt.verify(token, getJwtSecret());
    if (payload?.role !== 'SCHOOL' || !payload?.id) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  try {
    const payload = getSchoolPayload(request);
    if (!payload) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const school = await prisma.school.findUnique({
      where: { id: payload.id },
      select: {
        id: true,
        schoolId: true,
        olympiadId: true,
        name: true,
        address: true,
        email: true,
        phone: true,
        contactPerson: true,
        city: true,
        district: true,
        state: true,
        pincode: true,
        isActive: true,
        createdAt: true,
        examDate: true,
        attendanceSubmittedAt: true,
      },
    });

    if (!school) return NextResponse.json({ message: 'School not found' }, { status: 404 });

    return NextResponse.json(school);
  } catch (error) {
    console.error('GET school/me/profile failed:', error);
    return NextResponse.json({ message: 'Failed to fetch profile' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const payload = getSchoolPayload(request);
    if (!payload) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const body = await request.json().catch(() => null);
    if (!body || !('examDate' in body)) {
      return NextResponse.json({ message: 'examDate is required.' }, { status: 400 });
    }

    const school = await prisma.school.findUnique({
      where: { id: payload.id },
      select: { examDate: true, attendanceSubmittedAt: true },
    });
    if (!school) return NextResponse.json({ message: 'School not found' }, { status: 404 });

    if (school.attendanceSubmittedAt) {
      return NextResponse.json(
        { message: 'Attendance has already been submitted for this exam date, so it can no longer be changed. Contact your Mittsure coordinator.' },
        { status: 409 },
      );
    }

    // Clearing it back to unset is allowed (null); otherwise it must parse to
    // a real calendar date. No past-date restriction: a school correcting a
    // date they mistyped, including to an earlier day, is a legitimate edit —
    // the submit-attendance route is the one that enforces "not before exam day".
    let examDate: Date | null = null;
    if (body.examDate !== null && body.examDate !== '') {
      const parsed = new Date(body.examDate);
      if (Number.isNaN(parsed.getTime())) {
        return NextResponse.json({ message: 'Enter a valid exam date.' }, { status: 400 });
      }
      examDate = parsed;
    }

    const updated = await prisma.school.update({
      where: { id: payload.id },
      data: { examDate },
      select: { examDate: true },
    });

    await recordAuditLog({
      actorId: payload.id,
      actorRole: 'SCHOOL',
      actorName: payload.name || payload.schoolId || null,
      action: 'SCHOOL_EXAM_DATE_SET',
      entityType: 'School',
      entityId: payload.id,
      previousValue: { examDate: school.examDate },
      newValue: { examDate: updated.examDate },
    });

    return NextResponse.json({ examDate: updated.examDate });
  } catch (error) {
    console.error('PATCH school/me/profile failed:', error);
    return NextResponse.json({ message: 'Failed to update exam date' }, { status: 500 });
  }
}
