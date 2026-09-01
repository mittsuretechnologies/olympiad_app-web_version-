import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth-guard';
import { createNotification } from '@/lib/notifications';

// Loads the request and proves it belongs to the calling school, so one school
// can never act on another school's requests by guessing an id.
async function loadOwnRequest(schoolId: string, id: string) {
  return prisma.schoolLinkRequest.findFirst({
    where:  { id, schoolId },
    select: {
      id: true, status: true, appUserId: true,
      school: { select: { name: true } },
    },
  });
}

// PATCH /api/school/me/student-requests/:id  { action: 'APPROVE' | 'REJECT' }
//
// Approving builds the linkage and nothing else: the student gains no Olympiad
// ID, no permissions, and no change to any video. It only means their videos
// now resolve as this school's videos (see src/lib/schoolMembers.ts).
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { payload, error } = requireRole(request, ['SCHOOL']);
  if (error) return error;

  const { id } = await params;

  let body: any;
  try { body = await request.json(); } catch { body = {}; }
  const action = body?.action;

  if (action !== 'APPROVE' && action !== 'REJECT') {
    return NextResponse.json({ message: 'action must be APPROVE or REJECT' }, { status: 400 });
  }

  try {
    const link = await loadOwnRequest(payload.id, id);
    if (!link) return NextResponse.json({ message: 'Request not found' }, { status: 404 });

    if (link.status !== 'PENDING') {
      return NextResponse.json({ message: 'This request has already been decided' }, { status: 409 });
    }

    const status = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';

    await prisma.schoolLinkRequest.update({
      where: { id: link.id },
      data:  { status, decidedAt: new Date() },
    });

    const schoolName = link.school?.name || 'Your school';
    await createNotification({
      userId:  link.appUserId,
      type:    action === 'APPROVE' ? 'SCHOOL_LINK_APPROVED' : 'SCHOOL_LINK_REJECTED',
      title:   action === 'APPROVE' ? 'School request approved' : 'School request declined',
      message: action === 'APPROVE'
        ? `${schoolName} confirmed you as their student. Your videos now appear on your school page.`
        : `${schoolName} could not confirm you as their student. You can pick a different school.`,
    });

    return NextResponse.json({ id: link.id, status });
  } catch (err) {
    console.error('PATCH /api/school/me/student-requests/[id] failed:', err);
    return NextResponse.json({ message: 'Failed to update request' }, { status: 500 });
  }
}

// DELETE /api/school/me/student-requests/:id
// Breaks an existing link (or clears a decided row). The student's videos stop
// resolving as this school's immediately; nothing about the videos themselves
// changes, and they keep working everywhere else in the app.
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { payload, error } = requireRole(request, ['SCHOOL']);
  if (error) return error;

  const { id } = await params;

  try {
    const link = await loadOwnRequest(payload.id, id);
    if (!link) return NextResponse.json({ message: 'Request not found' }, { status: 404 });

    await prisma.schoolLinkRequest.delete({ where: { id: link.id } });

    if (link.status === 'APPROVED') {
      const schoolName = link.school?.name || 'Your school';
      await createNotification({
        userId:  link.appUserId,
        type:    'SCHOOL_LINK_REMOVED',
        title:   'Removed from school',
        message: `${schoolName} removed you from their student list. Your videos no longer appear on that school page.`,
      });
    }

    return NextResponse.json({ id: link.id, removed: true });
  } catch (err) {
    console.error('DELETE /api/school/me/student-requests/[id] failed:', err);
    return NextResponse.json({ message: 'Failed to remove student' }, { status: 500 });
  }
}
