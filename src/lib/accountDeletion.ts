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
export async function hardDeleteAppUser(appUserId: string): Promise<void> {
  await prisma.$transaction([
    prisma.video.deleteMany({ where: { appUserId } }),
    prisma.appUser.delete({ where: { id: appUserId } }),
  ]);

  // Storage cleanup runs after the DB is already clean — if this fails, the
  // account is still fully gone from the app; only an orphaned file remains,
  // which is a much smaller problem than blocking the deletion on it.
  try {
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
  } catch (err) {
    console.error(`hardDeleteAppUser: storage cleanup failed for ${appUserId}:`, err);
  }
}
