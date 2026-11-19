import { prisma } from '@/lib/prisma';
import { hardDeleteAppUser } from '@/lib/accountDeletion';
import { recordAuditLog } from '@/lib/audit-log';
import { createNotification } from '@/lib/notifications';
import { isMailerConfigured, sendInactivityNoticeEmail } from '@/lib/mailer';

// Accounts unused for 12 months are erased, but only after a notice. The erase
// goes through hardDeleteAppUser, so the usual 180-day retained record applies.
//
//   day 0              last activity (login, or any app open - see /api/app/me)
//   day 335 (~11 mo)   notice sent (email + in-app/push); inactivityNoticeAt set
//   day 365 (12 mo)    erased, provided the notice went out >= 30 days earlier
//
// Opening the app clears inactivityNoticeAt and restarts the clock. An account
// with no reachable channel (no email, no push token) never gets a notice, so
// it is never erased.

const DAY = 24 * 60 * 60 * 1000;
export const INACTIVITY_NOTICE_DAYS = 335;
export const INACTIVITY_ERASE_DAYS = 365;
export const INACTIVITY_NOTICE_PERIOD_DAYS = 30;
const BATCH = 200;

// Activity was only recorded at login until /api/app/me started stamping it, so
// an account that stays signed in looked idle. Nobody is treated as inactive
// from before this date - the clock effectively starts here.
export const INACTIVITY_TRACKING_START = new Date('2026-11-19T00:00:00Z');

// Accounts this never touches: schools, students with an Olympiad ID, anything
// already suspended/banned or being deleted.
const eligible = {
  isVerified: true,
  olympiadId: null,
  schoolRefId: null,
  accountType: 'USER',
  deletionRequestedAt: null,
  suspendedAt: null,
};

const lastActivityBefore = (cutoff: Date) => ({
  AND: [
    { OR: [{ lastLoginAt: { lt: cutoff } }, { lastLoginAt: null, createdAt: { lt: cutoff } }] },
    // Activity before tracking began is unknowable: only the later of the two counts.
    ...(cutoff > INACTIVITY_TRACKING_START ? [] : [{ id: '__none__' }]),
  ],
});

export async function runInactiveAccountSweep(): Promise<{ noticed: number; erased: number }> {
  const now = Date.now();

  // 1) Notices.
  const noticeCutoff = new Date(Math.max(now - INACTIVITY_NOTICE_DAYS * DAY, 0));
  const toNotify = await prisma.appUser.findMany({
    where: { ...eligible, inactivityNoticeAt: null, ...lastActivityBefore(noticeCutoff) },
    select: { id: true, userId: true, email: true, guardianName: true, _count: { select: { pushTokens: true } } },
    take: BATCH,
  });

  let noticed = 0;
  const eraseOn = new Date(now + INACTIVITY_NOTICE_PERIOD_DAYS * DAY);
  for (const u of toNotify) {
    let reached = false;
    if (u.email && isMailerConfigured()) {
      try {
        await sendInactivityNoticeEmail({ to: u.email, guardianName: u.guardianName, username: u.userId, eraseOn });
        reached = true;
      } catch (e) {
        console.error(`inactivity notice email failed for ${u.id}:`, e);
      }
    }
    if (u._count.pushTokens > 0) {
      await createNotification({
        userId: u.id,
        type: 'INACTIVITY_NOTICE',
        title: 'Your account will be erased',
        message: 'You have not used Mittmee for almost a year. Sign in before ' +
          eraseOn.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) +
          ' to keep your account.',
      });
      reached = true;
    }
    if (reached) {
      await prisma.appUser.update({ where: { id: u.id }, data: { inactivityNoticeAt: new Date() } });
      noticed++;
    }
  }

  // 2) Erase: 12 months idle AND the notice is at least 30 days old.
  const eraseCutoff = new Date(now - INACTIVITY_ERASE_DAYS * DAY);
  const noticeBefore = new Date(now - INACTIVITY_NOTICE_PERIOD_DAYS * DAY);
  const toErase = await prisma.appUser.findMany({
    where: { ...eligible, inactivityNoticeAt: { lte: noticeBefore }, ...lastActivityBefore(eraseCutoff) },
    select: { id: true, userId: true },
    take: BATCH,
  });

  for (const u of toErase) {
    await recordAuditLog({
      actorId: 'system', actorRole: 'SYSTEM', actorName: 'Daily sweep',
      action: 'ACCOUNT_DELETED', entityType: 'AppUser', entityId: u.id,
      newValue: { userId: u.userId },
      reason: 'Inactive for 12 months, notice sent',
    });
    await hardDeleteAppUser(u.id, 'INACTIVE_12_MONTH');
  }

  return { noticed, erased: toErase.length };
}
