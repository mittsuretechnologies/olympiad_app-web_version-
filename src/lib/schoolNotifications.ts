// School notifications are switched off for now. To bring them back, remove the "// " prefix below.
// import { prisma } from '@/lib/prisma';
//
// export type SchoolNotificationType = 'PASSPORTS_RELEASED' | 'OLYMPIAD_IDS_ADDED' | 'ANNOUNCEMENT';
//
// interface NotificationInput {
//   type: SchoolNotificationType;
//   title: string;
//   message: string;
//   link?: string | null;
//   createdBy?: string | null;
// }
//
// // One row per school, all sharing one createdAt so a broadcast can be told
// // apart in the sent history. Best-effort like lib/notifications.ts: callers
// // have already done their real work, so a failure here (or the table not
// // existing yet) is logged and never thrown. Returns how many rows were made.
// export async function notifySchools(schoolIds: string[], input: NotificationInput): Promise<number> {
//   if (schoolIds.length === 0) return 0;
//   try {
//     const createdAt = new Date();
//     const res = await prisma.schoolNotification.createMany({
//       data: schoolIds.map(schoolId => ({
//         schoolId, type: input.type, title: input.title, message: input.message,
//         link: input.link ?? null, createdBy: input.createdBy ?? null, createdAt,
//       })),
//     });
//     return res.count;
//   } catch (error) {
//     console.error('Failed to create school notifications:', error, input.type);
//     return 0;
//   }
// }
//
export {};
