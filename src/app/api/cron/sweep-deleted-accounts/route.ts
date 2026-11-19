import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { recordAuditLog } from '@/lib/audit-log';
import { runInactiveAccountSweep } from '@/lib/inactiveAccounts';
import { DELETED_ACCOUNT_RETENTION_DAYS, hardDeleteAppUser, purgeArchivedAccounts } from '@/lib/accountDeletion';

// Daily sweep for viewers whose 30-day grace window has run out.
// Students never get deletionRequestedAt set by this app (they go through
// AccountDeletionRequest + SuperAdmin approval instead), but this query
// filters on olympiadId: null anyway, defensively — this endpoint should
// only ever touch the viewer path.
//
// Triggered by Vercel Cron (see vercel.json) once a day. Protected by
// CRON_SECRET so it can't be hit by anyone who finds the URL — Vercel Cron
// sends this automatically as a Bearer token on every invocation it makes.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const due = await prisma.appUser.findMany({
      where:  { olympiadId: null, deletionRequestedAt: { lte: cutoff } },
      select: { id: true, userId: true },
    });

    for (const user of due) {
      await hardDeleteAppUser(user.id, 'VIEWER_30_DAY');
    }

    // Accounts banned 180+ days ago (and never reinstated) are permanently
    // deleted. Their data was kept intact for the whole ban, so no new archive.
    const banCutoff = new Date(Date.now() - DELETED_ACCOUNT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const bannedDue = await prisma.appUser.findMany({
      where:  { suspensionType: 'BAN', suspendedAt: { lte: banCutoff }, schoolRefId: null },
      select: { id: true, userId: true },
    });
    for (const user of bannedDue) {
      await recordAuditLog({
        actorId: 'system', actorRole: 'SYSTEM', actorName: 'Daily sweep',
        action: 'ACCOUNT_DELETED', entityType: 'AppUser', entityId: user.id,
        newValue: { userId: user.userId },
        reason: `Banned ${DELETED_ACCOUNT_RETENTION_DAYS}+ days ago and not reinstated`,
      });
      await hardDeleteAppUser(user.id, 'BANNED_180_DAY', { archive: false });
    }

    // 12 months unused: notice first, erase 30 days later (kept 180 days).
    const inactive = await runInactiveAccountSweep();

    // Archived records whose 180-day retention is over go for good.
    // (record, password hash and video/avatar files).
    const purged = await purgeArchivedAccounts();

    return NextResponse.json({
      deletedCount: due.length, deletedUserIds: due.map(u => u.userId), bannedDeletedCount: bannedDue.length,
      inactiveNoticed: inactive.noticed, inactiveErased: inactive.erased,
      purgedArchiveCount: purged.purged, purgeFailed: purged.failed,
    });
  } catch (error: any) {
    console.error('sweep-deleted-accounts error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
