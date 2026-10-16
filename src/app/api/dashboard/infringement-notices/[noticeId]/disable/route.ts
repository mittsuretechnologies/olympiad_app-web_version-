import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { recordAuditLog } from '@/lib/audit-log';
import { requireInfringementAdmin } from '../../auth';
import { COPYRIGHT_DISABLED, copyrightReviewDueAt, formatReviewDate } from '@/lib/copyright';
import { notifyUploaderOfCopyrightAction } from '@/lib/infringementNotices';

export const dynamic = 'force-dynamic';

// POST /api/dashboard/infringement-notices/:noticeId/disable — body: { note? }
// Takes the linked video down under the Infringement Policy (5.2–5.4, 6.1):
// hidden everywhere, a notice shown in its place, and a review set for 21 days
// from the date of the notice.
export async function POST(request: Request, { params }: { params: Promise<{ noticeId: string }> }) {
  const admin = await requireInfringementAdmin(request);
  if (!admin) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });

  try {
    const { noticeId } = await params;
    const { note } = await request.json().catch(() => ({}));
    const reason = typeof note === 'string' && note.trim() ? note.trim().slice(0, 1000) : null;

    const notice = await prisma.infringementNotice.findUnique({
      where: { id: noticeId },
      include: { video: true },
    });
    if (!notice) return NextResponse.json({ message: 'Notice not found' }, { status: 404 });
    const video = notice.video;
    if (!video) return NextResponse.json({ message: 'Link the video to this notice first.' }, { status: 400 });
    if (video.deletedAt) return NextResponse.json({ message: 'This video has already been deleted.' }, { status: 409 });
    if (video.status === COPYRIGHT_DISABLED) {
      return NextResponse.json({ message: 'This video is already disabled for copyright.' }, { status: 409 });
    }

    const now = new Date();
    const reviewDueAt = copyrightReviewDueAt(notice.createdAt);

    const done = await prisma.$transaction(async (tx) => {
      // Conditional on the status just read, so a moderator's concurrent change can't be overwritten.
      const changed = await tx.video.updateMany({
        where: { id: video.id, status: video.status, deletedAt: null },
        data: { status: COPYRIGHT_DISABLED },
      });
      if (changed.count !== 1) return false;
      await tx.infringementNotice.update({
        where: { id: noticeId },
        data: {
          status: 'CONTENT_REMOVED',
          resolvedAt: now,
          disabledAt: now,
          disabledById: admin.id,
          disabledByName: admin.name || admin.email || null,
          videoPrevStatus: video.status,
          reviewDueAt,
          reviewReminderSentAt: null,
          reviewOutcome: null,
          reviewedAt: null,
        },
      });
      return true;
    });
    if (!done) return NextResponse.json({ message: 'The video changed while you were acting on it. Refresh and try again.' }, { status: 409 });

    await recordAuditLog({
      actorId: admin.id, actorRole: admin.role, actorName: admin.name || admin.email || null,
      action: 'COPYRIGHT_VIDEO_DISABLED', entityType: 'Video', entityId: video.id,
      previousValue: { status: video.status },
      newValue: { status: COPYRIGHT_DISABLED, noticeId, referenceId: notice.referenceId, reviewDueAt },
      reason,
    });
    await notifyUploaderOfCopyrightAction(video, {
      kind: 'DISABLED', referenceId: notice.referenceId, reviewDate: formatReviewDate(reviewDueAt),
    });

    return NextResponse.json({ success: true, reviewDueAt });
  } catch (error: any) {
    console.error('POST dashboard/infringement-notices/:noticeId/disable failed:', error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
