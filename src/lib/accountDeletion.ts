import { rm } from 'fs/promises';
import path from 'path';
import { prisma } from '@/lib/prisma';
import { s3Enabled, deleteS3Prefix } from '@/lib/s3';

// Permanently wipes an AppUser and everything tied to them — true hard delete,
// no soft-delete/retention (unlike Video's own DELETE route, which only stamps
// deletedAt). Used by both deletion paths:
//   - the 30-day sweep (api/cron/sweep-deleted-accounts) for viewers
//   - a SuperAdmin approving an AccountDeletionRequest for a student
//
// Videos aren't a real FK relation on AppUser (Video.appUserId is a plain
// string column), so they need an explicit deleteMany before the AppUser row
// goes — everything else (Follow, FollowRequest, ReelShare, VideoReport,
// SupportTicket, Notification, SchoolLinkRequest, AccountDeletionRequest)
// cascades automatically per the schema.
// How long a deleted account's record is kept before it is purged for good.
export const DELETED_ACCOUNT_RETENTION_DAYS = 180;

// A banned account has already been kept intact for the whole 180 days, so its
// final deletion passes archive:false (no second retention) and removes the
// files straight away.
export async function hardDeleteAppUser(
  appUserId: string,
  reason = 'ACCOUNT_DELETED',
  opts: { archive?: boolean } = {},
): Promise<void> {
  if (opts.archive === false) {
    await prisma.$transaction([
      prisma.video.deleteMany({ where: { appUserId } }),
      prisma.appUser.delete({ where: { id: appUserId } }),
    ]);
    try {
      await deleteAccountStorage(appUserId);
    } catch (err) {
      console.error(`hardDeleteAppUser: storage cleanup failed for ${appUserId}:`, err);
    }
    return;
  }

  // Snapshot first, so the record survives for the retention period: profile,
  // the bcrypt password hash and video/avatar links. The files themselves stay in
  // storage until purgeArchivedAccounts removes them. The readable password
  // (plainPassword) and OTPs are deliberately left out.
  const [user, videos, request] = await Promise.all([
    prisma.appUser.findUnique({
      where: { id: appUserId },
      select: {
        userId: true, email: true, mobile: true, olympiadId: true, accountType: true,
        password: true, avatarUrl: true,
        guardianName: true, childName: true, dateOfBirth: true, unlistedSchoolName: true,
        termsAccepted: true, termsAcceptedAt: true, createdAt: true, lastLoginAt: true,
        deletionRequestedAt: true, deletionAgreedAt: true,
      },
    }),
    prisma.video.findMany({
      where: { appUserId },
      select: {
        id: true, caption: true, category: true, subCategory: true, tags: true, status: true, createdAt: true,
        videoUrl: true, hlsUrl: true, thumbnailUrl: true,
      },
    }),
    prisma.accountDeletionRequest.findFirst({
      where: { appUserId }, orderBy: { createdAt: 'desc' }, select: { createdAt: true, agreedAt: true },
    }),
  ]);

  const now = Date.now();
  const archive = user
    ? [prisma.deletedAccountArchive.create({
        data: {
          appUserId,
          userId: user.userId,
          reason,
          snapshot: JSON.parse(JSON.stringify({ ...user, deletionRequest: request, videos })),
          purgeAt: new Date(now + DELETED_ACCOUNT_RETENTION_DAYS * 24 * 60 * 60 * 1000),
        },
      })]
    : [];

  await prisma.$transaction([
    ...archive,
    prisma.video.deleteMany({ where: { appUserId } }),
    prisma.appUser.delete({ where: { id: appUserId } }),
  ]);

  // The video/avatar files are intentionally left in storage here - they are
  // part of the 180-day retained record and are removed by purgeArchivedAccounts.
}

// Removes a deleted account's files from storage. Throws on failure so the
// purge keeps the archive row and retries on the next run (nothing is orphaned).
async function deleteAccountStorage(appUserId: string): Promise<void> {
  if (s3Enabled()) {
    await Promise.all([
      deleteS3Prefix(`uploads/app-avatars/${appUserId}/`),
      deleteS3Prefix(`uploads/app-videos/${appUserId}/`),
    ]);
  } else {
    const root = process.cwd();
    await Promise.all([
      rm(path.join(root, 'public', 'uploads', 'app-avatars', appUserId), { recursive: true, force: true }),
      rm(path.join(root, 'public', 'uploads', 'app-videos', appUserId), { recursive: true, force: true }),
    ]);
  }
}

// Final removal once the 180 days are up: files first, then the archive row.
// A row whose file cleanup fails stays and is retried tomorrow.
export async function purgeArchivedAccounts(): Promise<{ purged: number; failed: number }> {
  const due = await prisma.deletedAccountArchive.findMany({
    where: { purgeAt: { lte: new Date() } },
    select: { id: true, appUserId: true },
  });
  let purged = 0, failed = 0;
  for (const row of due) {
    try {
      await deleteAccountStorage(row.appUserId);
      await prisma.deletedAccountArchive.delete({ where: { id: row.id } });
      purged++;
    } catch (err) {
      failed++;
      console.error(`purgeArchivedAccounts: ${row.appUserId} failed, will retry:`, err);
    }
  }
  return { purged, failed };
}
