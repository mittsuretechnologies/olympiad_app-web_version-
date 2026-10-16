import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { recordAuditLog } from '@/lib/audit-log';
import { requireInfringementAdmin } from '../../auth';
import { COPYRIGHT_DISABLED } from '@/lib/copyright';
import { notifyUploaderOfCopyrightAction } from '@/lib/infringementNotices';

export const dynamic = 'force-dynamic';

const ACTIONS = ['RESTORE', 'REMOVE', 'EXTEND'] as const;
type Action = (typeof ACTIONS)[number];

// POST /api/dashboard/infringement-notices/:noticeId/review
// body: { action: 'RESTORE' | 'REMOVE' | 'EXTEND', reason, dueAt? (EXTEND: ISO date) }
// Closes (or postpones) the 21-day review of a copyright takedown (Policy 6.1–6.3).
export async function POST(request: Request, { params }: { params: Promise<{ noticeId: string }> }) {
  const admin = await requireInfringementAdmin(request);
  if (!admin) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });

  try {
    const { noticeId } = await params;
    const body = await request.json().catch(() => ({}));
    const action = body.action as Action;
    if (!ACTIONS.includes(action)) return NextResponse.json({ message: 'Invalid action' }, { status: 400 });
    const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 1000) : '';
    if (!reason) return NextResponse.json({ message: 'Give a reason — it is kept in the Audit Log.' }, { status: 400 });

    const notice = await prisma.infringementNotice.findUnique({ where: { id: noticeId }, include: { video: true } });
    if (!notice) return NextResponse.json({ message: 'Notice not found' }, { status: 404 });
    const video = notice.video;
    if (!notice.disabledAt || notice.reviewOutcome || !video || video.status !== COPYRIGHT_DISABLED) {
      return NextResponse.json({ message: 'This notice has no open copyright review.' }, { status: 409 });
    }

    const actor = { actorId: admin.id, actorRole: admin.role, actorName: admin.name || admin.email || null };
    const now = new Date();

    if (action === 'EXTEND') {
      const dueAt = new Date(body.dueAt);
      if (isNaN(dueAt.getTime()) || dueAt <= now) {
        return NextResponse.json({ message: 'Choose a new review date in the future.' }, { status: 400 });
      }
      await prisma.infringementNotice.update({
        where: { id: noticeId },
        data: { reviewDueAt: dueAt, reviewReminderSentAt: null },
      });
      await recordAuditLog({
        ...actor, action: 'COPYRIGHT_REVIEW_EXTENDED', entityType: 'InfringementNotice', entityId: noticeId,
        previousValue: { reviewDueAt: notice.reviewDueAt }, newValue: { reviewDueAt: dueAt }, reason,
      });
      return NextResponse.json({ success: true, reviewDueAt: dueAt });
    }

    if (action === 'RESTORE') {
      // Another open takedown on the same video keeps it down; this notice's review still closes.
      const otherOpen = await prisma.infringementNotice.count({
        where: { videoId: video.id, id: { not: noticeId }, disabledAt: { not: null }, reviewOutcome: null },
      });
      const restoreTo = notice.videoPrevStatus && notice.videoPrevStatus !== COPYRIGHT_DISABLED ? notice.videoPrevStatus : 'APPROVED';
      await prisma.$transaction([
        ...(otherOpen === 0
          ? [prisma.video.updateMany({ where: { id: video.id, status: COPYRIGHT_DISABLED }, data: { status: restoreTo } })]
          : []),
        prisma.infringementNotice.update({ where: { id: noticeId }, data: { reviewOutcome: 'RESTORED', reviewedAt: now } }),
      ]);
      await recordAuditLog({
        ...actor, action: 'COPYRIGHT_VIDEO_RESTORED', entityType: 'Video', entityId: video.id,
        previousValue: { status: COPYRIGHT_DISABLED },
        newValue: { status: otherOpen === 0 ? restoreTo : COPYRIGHT_DISABLED, noticeId, referenceId: notice.referenceId },
        reason,
      });
      if (otherOpen === 0) await notifyUploaderOfCopyrightAction(video, { kind: 'RESTORED' });
      return NextResponse.json({ success: true, stillDisabledByOtherNotice: otherOpen > 0 });
    }

    // REMOVE: soft delete, like a removal after user reports — the record and its history stay.
    await prisma.$transaction([
      prisma.video.update({ where: { id: video.id }, data: { deletedAt: now } }),
      prisma.infringementNotice.updateMany({
        where: { videoId: video.id, disabledAt: { not: null }, reviewOutcome: null },
        data: { reviewOutcome: 'REMOVED_PERMANENTLY', reviewedAt: now },
      }),
    ]);
    await recordAuditLog({
      ...actor, action: 'COPYRIGHT_VIDEO_REMOVED', entityType: 'Video', entityId: video.id,
      previousValue: { status: COPYRIGHT_DISABLED, deletedAt: null },
      newValue: { deletedAt: now, noticeId, referenceId: notice.referenceId },
      reason,
    });
    await notifyUploaderOfCopyrightAction(video, { kind: 'REMOVED', referenceId: notice.referenceId });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('POST dashboard/infringement-notices/:noticeId/review failed:', error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
