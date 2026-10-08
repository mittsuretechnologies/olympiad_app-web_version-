import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { recordAuditLog } from '@/lib/audit-log';
import { requireModule } from '@/lib/auth-guard';
import { getJwtSecret } from '@/lib/jwt-secret';
import { createNotification } from '@/lib/notifications';
import { sendVideoRemovedEmail } from '@/lib/mailer';

// Tells the uploader in-app and emails the parent/guardian at the account's
// address. Web-portal student uploads carry studentId instead of appUserId, so
// those reach the student's app account through its Olympiad code. Both
// channels are best-effort: the removal has already happened.
async function notifyUploaderOfRemoval(video: {
  id: string; appUserId: string | null; studentId: string | null;
  caption: string | null; category: string | null; subCategory: string | null;
}) {
  const label = video.caption?.trim() || video.subCategory || video.category || 'your video';

  let appUser = video.appUserId
    ? await prisma.appUser.findUnique({
        where: { id: video.appUserId },
        select: { id: true, email: true, olympiadId: true, guardianName: true, childName: true },
      })
    : null;
  if (!appUser && video.studentId) {
    const student = await prisma.student.findUnique({ where: { id: video.studentId }, select: { olympiadCode: true } });
    appUser = student
      ? await prisma.appUser.findFirst({
          where: { olympiadId: student.olympiadCode },
          select: { id: true, email: true, olympiadId: true, guardianName: true, childName: true },
        })
      : null;
  }
  if (!appUser) return;

  await createNotification({
    userId:  appUser.id,
    type:    'VIDEO_REMOVED',
    title:   'Video Removed',
    message: `Your video "${label}" was removed after being reported and reviewed by our moderation team, as it does not follow our Community Guidelines.`,
    videoId: video.id,
  });

  if (!appUser.email) return;
  // Olympiad accounts keep the parent and child names on the ID allocation.
  const allocation = appUser.olympiadId
    ? await prisma.olympiadIdAllocation.findUnique({
        where: { code: appUser.olympiadId },
        select: { guardianName: true, assignedName: true },
      })
    : null;
  try {
    await sendVideoRemovedEmail({
      to: appUser.email,
      guardianName: allocation?.guardianName || appUser.guardianName,
      childName: allocation?.assignedName || appUser.childName,
      videoLabel: label,
    });
  } catch (e) {
    console.error(`Video-removed email for ${video.id} to ${appUser.email} failed:`, e);
  }
}

function requireModerationAccess(request: Request) {
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  try {
    const payload = jwt.verify(token, getJwtSecret()) as any;
    return ['SUPERADMIN', 'MODERATOR'].includes(payload?.role) ? payload : null;
  } catch {
    return null;
  }
}

// POST /api/dashboard/reported-videos/:videoId/action — body: { action: 'ignore' | 'remove' }
export async function POST(
  request: Request,
  { params }: { params: Promise<{ videoId: string }> }
) {
  const admin = requireModerationAccess(request);
  if (!admin) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });

  const moduleCheck = await requireModule(admin, 'moderation.reported');
  if (moduleCheck.error) return moduleCheck.error;

  const { videoId } = await params;

  try {
    const { action } = await request.json();
    if (action !== 'ignore' && action !== 'remove') {
      return NextResponse.json({ message: 'action must be "ignore" or "remove"' }, { status: 400 });
    }

    const video = await prisma.video.findUnique({ where: { id: videoId } });
    if (!video) return NextResponse.json({ message: 'Video not found' }, { status: 404 });

    if (action === 'ignore') {
      await prisma.videoReport.updateMany({
        where: { videoId, resolved: false },
        data:  { resolved: true },
      });

      await recordAuditLog({
        actorId: admin.id,
        actorRole: admin.role,
        actorName: admin.name || admin.email || null,
        action: 'REPORT_IGNORED',
        entityType: 'VideoReport',
        entityId: videoId,
        previousValue: { resolved: false },
        newValue: { resolved: true },
      });
    } else {
      // Soft delete — same mechanism as the owner-initiated delete, preserves the
      // record and evaluation history for audit purposes.
      await prisma.video.update({ where: { id: videoId }, data: { deletedAt: new Date() } });
      await prisma.videoReport.updateMany({
        where: { videoId, resolved: false },
        data:  { resolved: true },
      });

      await recordAuditLog({
        actorId: admin.id,
        actorRole: admin.role,
        actorName: admin.name || admin.email || null,
        action: 'REPORT_VIDEO_REMOVED',
        entityType: 'Video',
        entityId: videoId,
        previousValue: { deletedAt: video.deletedAt },
        newValue: { deletedAt: new Date() },
        reason: 'Removed following user report(s)',
      });

      await notifyUploaderOfRemoval(video);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('POST dashboard/reported-videos/:videoId/action failed:', error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
