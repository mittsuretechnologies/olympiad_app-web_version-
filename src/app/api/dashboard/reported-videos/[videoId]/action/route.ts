import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { recordAuditLog } from '@/lib/audit-log';
import { requireModule } from '@/lib/auth-guard';

function requireModerationAccess(request: Request) {
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret') as any;
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
        actorName: admin.email || admin.name || null,
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
        actorName: admin.email || admin.name || null,
        action: 'REPORT_VIDEO_REMOVED',
        entityType: 'Video',
        entityId: videoId,
        previousValue: { deletedAt: video.deletedAt },
        newValue: { deletedAt: new Date() },
        reason: 'Removed following user report(s)',
      });

      if (video.appUserId) {
        const label = video.caption?.trim() || video.subCategory || video.category || 'your video';
        await prisma.notification.create({
          data: {
            userId:  video.appUserId,
            type:    'VIDEO_REMOVED',
            title:   'Video Removed',
            message: `Your video "${label}" was removed by an admin after being reported for violating our content guidelines.`,
          },
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('POST dashboard/reported-videos/:videoId/action failed:', error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
