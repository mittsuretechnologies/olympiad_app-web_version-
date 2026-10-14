import { prisma } from '@/lib/prisma';
import { reviewReminderCutoff } from '@/lib/copyright';
import { createNotification } from '@/lib/notifications';
import { findUploaderAppUser, videoLabel } from '@/lib/videoUploader';
import { sendCopyrightTakedownEmail } from '@/lib/mailer';

type NotifiableVideo = {
  id: string; appUserId: string | null; studentId: string | null;
  caption: string | null; category: string | null; subCategory: string | null;
};

// Tells the uploader in-app (and, on a takedown, emails the parent/guardian).
// Best-effort: the takedown / restore has already happened.
export async function notifyUploaderOfCopyrightAction(
  video: NotifiableVideo,
  event:
    | { kind: 'DISABLED'; referenceId: string; reviewDate: string }
    | { kind: 'RESTORED' }
    | { kind: 'REMOVED'; referenceId: string },
) {
  const appUser = await findUploaderAppUser(video);
  if (!appUser) return;
  const label = videoLabel(video);

  if (event.kind === 'DISABLED') {
    await createNotification({
      userId: appUser.id,
      type: 'VIDEO_COPYRIGHT_DISABLED',
      title: 'Video removed – copyright complaint',
      message: `Your video "${label}" has been removed following a copyright complaint (ref ${event.referenceId}). ` +
        `It will stay unavailable until at least ${event.reviewDate}, when we will review it. ` +
        `If you believe this is a mistake, contact us through Help & Support quoting the reference.`,
      videoId: video.id,
    });
    if (!appUser.email) return;
    const allocation = appUser.olympiadId
      ? await prisma.olympiadIdAllocation.findUnique({
          where: { code: appUser.olympiadId },
          select: { guardianName: true, assignedName: true },
        })
      : null;
    try {
      await sendCopyrightTakedownEmail({
        to: appUser.email,
        guardianName: allocation?.guardianName || appUser.guardianName,
        childName: allocation?.assignedName || appUser.childName,
        videoLabel: label,
        referenceId: event.referenceId,
        reviewDate: event.reviewDate,
      });
    } catch (e) {
      console.error(`Copyright takedown email for ${video.id} to ${appUser.email} failed:`, e);
    }
  } else if (event.kind === 'RESTORED') {
    await createNotification({
      userId: appUser.id,
      type: 'VIDEO_COPYRIGHT_RESTORED',
      title: 'Video restored',
      message: `Your video "${label}" has been reviewed and is available again.`,
      videoId: video.id,
    });
  } else {
    await createNotification({
      userId: appUser.id,
      type: 'VIDEO_REMOVED',
      title: 'Video removed – copyright complaint',
      message: `Your video "${label}" has been permanently removed following a copyright complaint (ref ${event.referenceId}).`,
      videoId: video.id,
    });
  }
}

// Disabled for copyright, review still open, due within the reminder window or overdue.
export function reviewDueWhere(now = new Date()) {
  return { disabledAt: { not: null }, reviewOutcome: null, reviewDueAt: { lte: reviewReminderCutoff(now) } };
}

// The linked video as the Report Infringement page shows it.
export const NOTICE_VIDEO_SELECT = {
  id: true, status: true, videoUrl: true, thumbnailUrl: true, caption: true, category: true,
  subCategory: true, appUserId: true, studentId: true, deletedAt: true, createdAt: true,
  student: { select: { name: true } },
} as const;

type WithVideo = { video: { appUserId: string | null; student: { name: string } | null } | null };

// Adds who uploaded each linked video: the app handle, else the web-portal student's name.
export async function withUploaders<T extends WithVideo>(notices: T[]) {
  const ids = [...new Set(notices.map((n) => n.video?.appUserId).filter(Boolean) as string[])];
  const users = ids.length
    ? await prisma.appUser.findMany({ where: { id: { in: ids } }, select: { id: true, userId: true } })
    : [];
  const handle = new Map(users.map((u) => [u.id, u.userId]));
  return notices.map((n) => ({
    ...n,
    video: n.video
      ? { ...n.video, uploader: (n.video.appUserId && handle.get(n.video.appUserId)) || n.video.student?.name || null }
      : null,
  }));
}
