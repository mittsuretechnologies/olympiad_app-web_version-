import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { getJwtSecret } from '@/lib/jwt-secret';
import { inactiveSchoolResponse } from '@/lib/auth-guard';
import { recordAuditLog } from '@/lib/audit-log';

// POST -> file a request to set or change this school's exam date. Nothing
//         changes on the school until a SuperAdmin approves it in
//         /dashboard/schools/exam-date-requests. One pending request at a time.

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

export async function POST(request: Request) {
  try {
    const payload = getSchoolPayload(request);
    if (!payload) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    const blocked = await inactiveSchoolResponse(payload.id);
    if (blocked) return blocked;

    const body = await request.json().catch(() => null);
    const rawDate = typeof body?.requestedDate === 'string' ? body.requestedDate.trim() : '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(rawDate) || Number.isNaN(new Date(rawDate).getTime())) {
      return NextResponse.json({ message: 'Enter a valid exam date.' }, { status: 400 });
    }
    const requestedDate = new Date(rawDate);
    const reason = typeof body?.reason === 'string' && body.reason.trim() ? body.reason.trim().slice(0, 500) : null;

    const school = await prisma.school.findUnique({
      where: { id: payload.id },
      select: { examDate: true, attendanceSubmittedAt: true },
    });
    if (!school) return NextResponse.json({ message: 'School not found' }, { status: 404 });

    // After attendance is submitted the date is what attendance was marked
    // against, so it's frozen — same rule as before requests existed.
    if (school.attendanceSubmittedAt) {
      return NextResponse.json(
        { message: 'Attendance has already been submitted for this exam date, so it can no longer be changed. Contact your Mittsure coordinator.' },
        { status: 409 },
      );
    }

    if (school.examDate && school.examDate.toISOString().slice(0, 10) === rawDate) {
      return NextResponse.json({ message: 'This is already your exam date.' }, { status: 400 });
    }

    const pending = await prisma.examDateChangeRequest.findFirst({
      where: { schoolId: payload.id, status: 'PENDING' },
      select: { id: true },
    });
    if (pending) {
      return NextResponse.json(
        { message: 'You already have a request waiting for approval. Please wait for it to be reviewed.' },
        { status: 409 },
      );
    }

    const created = await prisma.examDateChangeRequest.create({
      data: { schoolId: payload.id, previousDate: school.examDate, requestedDate, reason },
      select: {
        id: true, previousDate: true, requestedDate: true, reason: true,
        status: true, remark: true, decidedAt: true, createdAt: true,
      },
    });

    await recordAuditLog({
      actorId: payload.id,
      actorRole: 'SCHOOL',
      actorName: payload.name || payload.schoolId || null,
      action: 'EXAM_DATE_CHANGE_REQUESTED',
      entityType: 'School',
      entityId: payload.id,
      previousValue: { examDate: school.examDate },
      newValue: { requestedDate, reason, requestId: created.id },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error: any) {
    console.error('POST school/me/exam-date-request failed:', error);
    // P2021 = table missing (migration not run yet); a TypeError here means the
    // running server's Prisma client predates the model (regenerate + restart).
    if (error?.code === 'P2021' || error instanceof TypeError) {
      return NextResponse.json({ message: 'Exam date requests are not available yet. Please try again later or contact your Mittsure coordinator.' }, { status: 503 });
    }
    return NextResponse.json({ message: 'Failed to send the request' }, { status: 500 });
  }
}
