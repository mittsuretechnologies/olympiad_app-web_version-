import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const auth = request.headers.get('authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    let payload: any;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    } catch {
      return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
    }

    if (payload?.role !== 'SCHOOL' || !payload?.id) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const { code } = await params;
    const { assignedName } = await request.json();

    if (!assignedName || !assignedName.trim()) {
      return NextResponse.json({ message: 'Student name is required' }, { status: 400 });
    }

    // Verify this allocation belongs to this school
    const allocation = await prisma.olympiadIdAllocation.findUnique({
      where: { code },
      include: { student: true },
    });

    if (!allocation) {
      return NextResponse.json({ message: 'Olympiad ID not found' }, { status: 404 });
    }
    if (allocation.schoolId !== payload.id) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }
    if (allocation.student) {
      return NextResponse.json({ message: 'This ID is already registered by a student' }, { status: 409 });
    }

    const updated = await prisma.olympiadIdAllocation.update({
      where: { code },
      data: {
        assignedName: assignedName.trim(),
        assignedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, assignedName: updated.assignedName });
  } catch (error) {
    console.error('PATCH assign failed:', error);
    return NextResponse.json({ message: 'Failed to assign' }, { status: 500 });
  }
}

// Unassign
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const auth = request.headers.get('authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    let payload: any;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    } catch {
      return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
    }

    if (payload?.role !== 'SCHOOL' || !payload?.id) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const { code } = await params;

    const allocation = await prisma.olympiadIdAllocation.findUnique({ where: { code }, include: { student: true } });
    if (!allocation) return NextResponse.json({ message: 'Not found' }, { status: 404 });
    if (allocation.schoolId !== payload.id) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    if (allocation.student) return NextResponse.json({ message: 'Cannot unassign — student already registered' }, { status: 409 });

    // If an app account was created via Allot Student, downgrade it to a plain
    // Viewer account (clear olympiadId) instead of deleting it — this frees the
    // ID for reassignment while keeping the account, its login, and its videos
    // intact. Their videos also stop being Olympiad/evaluation content: without
    // this, they'd keep showing the Olympiad badge and score forever, while
    // silently dropping out of this school's completion reports and any
    // region-scoped evaluator's queue (both are resolved via olympiadId).
    const freedAppUsers = await prisma.appUser.findMany({ where: { olympiadId: code }, select: { id: true } });
    const freedAppUserIds = freedAppUsers.map(u => u.id);

    if (freedAppUserIds.length > 0) {
      await prisma.video.updateMany({
        where: { appUserId: { in: freedAppUserIds }, isEvaluation: true },
        data: { isEvaluation: false, olympiadVisibility: null },
      });
    }

    await prisma.appUser.updateMany({ where: { olympiadId: code }, data: { olympiadId: null } });

    await prisma.olympiadIdAllocation.update({
      where: { code },
      data: { assignedName: null, assignedAt: null },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE unassign failed:', error);
    return NextResponse.json({ message: 'Failed to unassign' }, { status: 500 });
  }
}
