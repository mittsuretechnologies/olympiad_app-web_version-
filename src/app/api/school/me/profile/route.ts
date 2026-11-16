import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { getJwtSecret } from '@/lib/jwt-secret';
import { inactiveSchoolResponse } from '@/lib/auth-guard';

// GET -> the school's own profile (read-only fields + examDate) and its latest
//        exam-date change request. Schools can't edit anything here directly:
//        exam-date changes go through POST /api/school/me/exam-date-request and
//        a SuperAdmin's approval.

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
    const blocked = await inactiveSchoolResponse(payload.id);
    if (blocked) return blocked;

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

    // Best-effort: the profile must still load if this lookup fails — the
    // table not existing yet, or a stale Prisma client without the model
    // (which throws synchronously, so a .catch() alone wouldn't cover it).
    let examDateRequest = null;
    try {
      examDateRequest = await prisma.examDateChangeRequest.findFirst({
        where: { schoolId: payload.id },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, previousDate: true, requestedDate: true, reason: true,
          status: true, remark: true, decidedAt: true, createdAt: true,
        },
      });
    } catch (err) {
      console.error('GET school/me/profile: exam-date request lookup failed:', err);
    }

    return NextResponse.json({ ...school, examDateRequest });
  } catch (error) {
    console.error('GET school/me/profile failed:', error);
    return NextResponse.json({ message: 'Failed to fetch profile' }, { status: 500 });
  }
}
