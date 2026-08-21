import { prisma } from '@/lib/prisma';

/**
 * A school's members come from two independent paths:
 *
 *   1. Olympiad path — School → OlympiadIdAllocation.code → AppUser.olympiadId
 *      (and → Student.olympiadCode). This is the original linkage and covers
 *      everyone the school issued an Olympiad ID to.
 *
 *   2. Link-request path — SchoolLinkRequest with status APPROVED. This covers
 *      students of the school who never sat the Olympiad, so they have no
 *      allocation and path 1 can never reach them. The user asks from the app,
 *      the school approves from its portal.
 *
 * Both feeds (the app's school page and the portal's Student Videos page) must
 * resolve members through this helper so the two paths can never drift apart.
 *
 * Note this returns *membership* only. Neither caller changes its visibility
 * rules because of it: the app feed still applies visibilityWhere() + isPublic,
 * and the portal still shows every APPROVED video of its own members.
 */
export interface SchoolMembers {
  /** Olympiad allocation codes belonging to this school. */
  codes: string[];
  /** AppUser.id of members reached through an Olympiad ID. */
  olympiadAppUserIds: string[];
  /** AppUser.id of members reached through an approved link request. */
  linkedAppUserIds: string[];
  /** Union of both, deduped — what a feed should query videos for. */
  appUserIds: string[];
  /** Student.id of web-registered students of this school. */
  studentIds: string[];
}

export async function getSchoolMembers(schoolId: string): Promise<SchoolMembers> {
  const [allocations, linked] = await Promise.all([
    prisma.olympiadIdAllocation.findMany({
      where:  { schoolId },
      select: { code: true },
    }),
    prisma.schoolLinkRequest.findMany({
      where:  { schoolId, status: 'APPROVED' },
      select: { appUserId: true },
    }),
  ]);

  const codes = allocations.map(a => a.code);

  const [olympiadUsers, students] = await Promise.all([
    codes.length > 0
      ? prisma.appUser.findMany({
          where:  { olympiadId: { in: codes } },
          select: { id: true },
        })
      : Promise.resolve([] as { id: string }[]),
    codes.length > 0
      ? prisma.student.findMany({
          where:  { allocation: { code: { in: codes } } },
          select: { id: true },
        })
      : Promise.resolve([] as { id: string }[]),
  ]);

  const olympiadAppUserIds = olympiadUsers.map(u => u.id);
  const linkedAppUserIds   = linked.map(l => l.appUserId);

  return {
    codes,
    olympiadAppUserIds,
    linkedAppUserIds,
    // A user could hold an Olympiad ID *and* an approved link (e.g. they got an
    // ID after being approved) — dedupe or their videos would be double-counted.
    appUserIds: Array.from(new Set([...olympiadAppUserIds, ...linkedAppUserIds])),
    studentIds: students.map(s => s.id),
  };
}

/**
 * The reverse lookup: which school, if any, an app user belongs to via an
 * approved link request. Returns null when they have none.
 */
export async function getLinkedSchoolForUser(appUserId: string) {
  const link = await prisma.schoolLinkRequest.findFirst({
    where:  { appUserId, status: 'APPROVED' },
    select: {
      school: { select: { id: true, name: true, state: true, district: true, city: true, schoolId: true } },
    },
  });
  return link?.school ?? null;
}
