import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { recordAuditLog } from '@/lib/audit-log';

// PATCH /api/school/me/videos/:id/visibility — school-side Olympiad public/private
// visibility toggle. Requires BOTH the normal school session token AND a short-lived
// step-up token proving the school just completed OTP verification (see
// /api/school/me/video-visibility/{request-otp,verify-otp}).
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = request.headers.get('authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    let payload: any;
    try { payload = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret'); }
    catch { return NextResponse.json({ message: 'Invalid token' }, { status: 401 }); }
    if (payload?.role !== 'SCHOOL' || !payload?.id)
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });

    const stepUpHeader = request.headers.get('x-step-up-token') || '';
    let stepUpPayload: any;
    try { stepUpPayload = jwt.verify(stepUpHeader, process.env.JWT_SECRET || 'fallback_secret'); }
    catch { return NextResponse.json({ message: 'OTP verification required or expired.' }, { status: 401 }); }
    if (stepUpPayload?.role !== 'SCHOOL_VIDEO_VISIBILITY' || stepUpPayload?.schoolId !== payload.id) {
      return NextResponse.json({ message: 'OTP verification required or expired.' }, { status: 401 });
    }

    const { id } = await params;
    const { olympiadVisibility } = await request.json();
    if (olympiadVisibility !== 'public' && olympiadVisibility !== 'private') {
      return NextResponse.json({ message: 'olympiadVisibility must be "public" or "private"' }, { status: 400 });
    }

    const video = await prisma.video.findFirst({
      where: { id, deletedAt: null },
      include: {
        student: { select: { allocation: { select: { schoolId: true } } } },
      },
    });
    if (!video) return NextResponse.json({ message: 'Video not found' }, { status: 404 });

    let belongsToSchool = false;
    if (video.studentId) {
      belongsToSchool = video.student?.allocation?.schoolId === payload.id;
    } else if (video.appUserId) {
      const appUser = await prisma.appUser.findUnique({
        where: { id: video.appUserId },
        select: { olympiadId: true },
      });
      if (appUser?.olympiadId) {
        const allocation = await prisma.olympiadIdAllocation.findUnique({
          where: { code: appUser.olympiadId },
          select: { schoolId: true },
        });
        belongsToSchool = allocation?.schoolId === payload.id;
      }
    }
    if (!belongsToSchool) {
      return NextResponse.json({ message: 'This video does not belong to your school' }, { status: 403 });
    }

    if (!video.isEvaluation) {
      return NextResponse.json({ message: 'Visibility toggle is only available for Olympiad videos' }, { status: 400 });
    }

    const updated = await prisma.video.update({
      where: { id },
      data: { olympiadVisibility },
    });

    await recordAuditLog({
      actorId: payload.id,
      actorRole: 'SCHOOL',
      action: 'VISIBILITY_CHANGED',
      entityType: 'Video',
      entityId: id,
      previousValue: { olympiadVisibility: video.olympiadVisibility },
      newValue: { olympiadVisibility },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('School video visibility update error:', error);
    return NextResponse.json({ message: error.message || 'Failed to update visibility' }, { status: 500 });
  }
}
