import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { recordAuditLog } from '@/lib/audit-log';
import { requireInfringementAdmin } from '../../auth';
import { videoIdCandidates } from '@/lib/copyright';
import { NOTICE_VIDEO_SELECT, withUploaders } from '@/lib/infringementNotices';

export const dynamic = 'force-dynamic';

// The one video a pasted ID / link names, or an error response.
async function resolveVideo(input: unknown) {
  const ids = videoIdCandidates(typeof input === 'string' ? input : '');
  if (ids.length !== 1) {
    return { error: NextResponse.json({ message: 'Paste one video ID or a link that contains it.' }, { status: 400 }) };
  }
  const video = await prisma.video.findUnique({ where: { id: ids[0] }, select: NOTICE_VIDEO_SELECT });
  if (!video) return { error: NextResponse.json({ message: 'No video with that ID.' }, { status: 404 }) };
  const [withUploader] = await withUploaders([{ video }]);
  return { video: withUploader.video! };
}

// GET /api/dashboard/infringement-notices/:noticeId/video?q=<id or link> — preview before linking.
export async function GET(request: Request) {
  if (!await requireInfringementAdmin(request)) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  const { video, error } = await resolveVideo(new URL(request.url).searchParams.get('q'));
  return error ?? NextResponse.json({ video });
}

// POST /api/dashboard/infringement-notices/:noticeId/video — body: { video: <id or link> }
export async function POST(request: Request, { params }: { params: Promise<{ noticeId: string }> }) {
  const admin = await requireInfringementAdmin(request);
  if (!admin) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });

  try {
    const { noticeId } = await params;
    const { video: input } = await request.json();
    const notice = await prisma.infringementNotice.findUnique({
      where: { id: noticeId },
      select: { id: true, videoId: true, disabledAt: true, reviewOutcome: true },
    });
    if (!notice) return NextResponse.json({ message: 'Notice not found' }, { status: 404 });
    if (notice.disabledAt && !notice.reviewOutcome) {
      return NextResponse.json({ message: 'The linked video is disabled under this notice. Restore or remove it first.' }, { status: 409 });
    }

    const { video, error } = await resolveVideo(input);
    if (error) return error;

    await prisma.infringementNotice.update({ where: { id: noticeId }, data: { videoId: video.id } });
    await recordAuditLog({
      actorId: admin.id, actorRole: admin.role, actorName: admin.name || admin.email || null,
      action: 'INFRINGEMENT_VIDEO_LINKED', entityType: 'InfringementNotice', entityId: noticeId,
      previousValue: { videoId: notice.videoId }, newValue: { videoId: video.id },
    });
    return NextResponse.json({ video });
  } catch (error: any) {
    console.error('POST dashboard/infringement-notices/:noticeId/video failed:', error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

// DELETE /api/dashboard/infringement-notices/:noticeId/video — unlink.
export async function DELETE(request: Request, { params }: { params: Promise<{ noticeId: string }> }) {
  const admin = await requireInfringementAdmin(request);
  if (!admin) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });

  try {
    const { noticeId } = await params;
    const notice = await prisma.infringementNotice.findUnique({
      where: { id: noticeId },
      select: { videoId: true, disabledAt: true, reviewOutcome: true },
    });
    if (!notice) return NextResponse.json({ message: 'Notice not found' }, { status: 404 });
    if (notice.disabledAt && !notice.reviewOutcome) {
      return NextResponse.json({ message: 'The linked video is disabled under this notice. Restore or remove it first.' }, { status: 409 });
    }

    await prisma.infringementNotice.update({ where: { id: noticeId }, data: { videoId: null } });
    await recordAuditLog({
      actorId: admin.id, actorRole: admin.role, actorName: admin.name || admin.email || null,
      action: 'INFRINGEMENT_VIDEO_UNLINKED', entityType: 'InfringementNotice', entityId: noticeId,
      previousValue: { videoId: notice.videoId }, newValue: { videoId: null },
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('DELETE dashboard/infringement-notices/:noticeId/video failed:', error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
