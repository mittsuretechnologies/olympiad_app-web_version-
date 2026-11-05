import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth-guard';
import { recordAuditLog } from '@/lib/audit-log';

// PATCH /api/dashboard/exam-date-requests/:id
// body: { action: 'approve' | 'reject', remark?: string }
// Approve writes requestedDate onto the school; reject needs a remark, which
// the school sees on its profile page.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { payload, error } = await requireAdmin(request, 'schools.examDateRequests');
  if (error) return error;

  const { id } = await params;

  try {
    const body = await request.json().catch(() => ({}));
    const action = body?.action;
    if (action !== 'approve' && action !== 'reject') {
      return NextResponse.json({ message: 'action must be "approve" or "reject"' }, { status: 400 });
    }
    const remark = typeof body?.remark === 'string' && body.remark.trim() ? body.remark.trim().slice(0, 500) : null;
    if (action === 'reject' && !remark) {
      return NextResponse.json({ message: 'Please add a remark for the school explaining why.' }, { status: 400 });
    }

    const reqRow = await prisma.examDateChangeRequest.findUnique({
      where: { id },
      select: {
        id: true, status: true, requestedDate: true, schoolId: true,
        school: { select: { examDate: true, attendanceSubmittedAt: true } },
      },
    });
    if (!reqRow) return NextResponse.json({ message: 'Request not found' }, { status: 404 });
    if (reqRow.status !== 'PENDING') {
      return NextResponse.json({ message: 'This request has already been decided' }, { status: 409 });
    }
    if (action === 'approve' && reqRow.school.attendanceSubmittedAt) {
      return NextResponse.json(
        { message: 'This school has already submitted attendance, so its exam date is locked. Reopen attendance first, or reject this request.' },
        { status: 409 },
      );
    }

    const actorName = payload.name || payload.email || null;
    const decision = {
      status: action === 'approve' ? 'APPROVED' : 'REJECTED',
      remark,
      decidedBy: payload.id as string,
      decidedByName: actorName,
      decidedAt: new Date(),
    };

    // The status guard in the WHERE makes a double click (or two admins at
    // once) a no-op the second time instead of applying the decision twice.
    const applied = await prisma.$transaction(async (tx) => {
      const { count } = await tx.examDateChangeRequest.updateMany({
        where: { id, status: 'PENDING' },
        data: decision,
      });
      if (count === 0) return false;
      if (action === 'approve') {
        await tx.school.update({ where: { id: reqRow.schoolId }, data: { examDate: reqRow.requestedDate } });
      }
      return true;
    });
    if (!applied) {
      return NextResponse.json({ message: 'This request has already been decided' }, { status: 409 });
    }

    await recordAuditLog({
      actorId: payload.id, actorRole: payload.role, actorName,
      action: action === 'approve' ? 'EXAM_DATE_CHANGE_APPROVED' : 'EXAM_DATE_CHANGE_REJECTED',
      entityType: 'School', entityId: reqRow.schoolId,
      previousValue: { examDate: reqRow.school.examDate },
      newValue: { requestedDate: reqRow.requestedDate, requestId: id, status: decision.status },
      reason: remark,
    });

    return NextResponse.json({ success: true, status: decision.status });
  } catch (error) {
    console.error('PATCH /api/dashboard/exam-date-requests/[id] failed:', error);
    return NextResponse.json({ message: 'Failed to update request' }, { status: 500 });
  }
}
