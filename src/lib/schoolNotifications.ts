import { prisma } from '@/lib/prisma';

const CHUNK = 1000;

export type SchoolNotificationType = 'PASSPORTS_RELEASED' | 'OLYMPIAD_IDS_ADDED' | 'ANNOUNCEMENT';

interface NotificationInput {
  type: SchoolNotificationType;
  title: string;
  message: string;
  link?: string | null;
  createdBy?: string | null;
}

// One row per school, all sharing one createdAt so a broadcast can be told
// apart in the sent history (Dashboard → School Notifications). broadcastId
// stays null: that field links a row to an App Notifications broadcast, which
// these are not. Best-effort like lib/notifications.ts: callers have already
// done their real work, so a failure here is logged and never thrown.
// Returns how many rows were made.
export async function notifySchools(schoolIds: string[], input: NotificationInput): Promise<number> {
  if (schoolIds.length === 0) return 0;
  try {
    const createdAt = new Date();
    const rows = schoolIds.map(schoolId => ({
      schoolId, type: input.type, title: input.title, message: input.message,
      link: input.link ?? null, createdBy: input.createdBy ?? null, createdAt,
    }));
    // In chunks (one insert has a bind-parameter limit), all or nothing so a
    // failure part-way never leaves only some schools notified.
    const ops = [];
    for (let i = 0; i < rows.length; i += CHUNK) {
      ops.push(prisma.schoolNotification.createMany({ data: rows.slice(i, i + CHUNK) }));
    }
    const results = await prisma.$transaction(ops);
    return results.reduce((n, r) => n + r.count, 0);
  } catch (error) {
    console.error('Failed to create school notifications:', error, input.type);
    return 0;
  }
}
