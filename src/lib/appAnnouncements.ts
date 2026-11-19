import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import type { AnnouncementFilters, AnnouncementType } from '@/lib/appAnnouncementShared';

export * from '@/lib/appAnnouncementShared';

// SuperAdmin → App Notifications (server side).
//
// Who is who (same split as the rest of the app):
//   General User     — app account, not a school, no Olympiad ID
//   Olympiad Student — app account with an Olympiad ID
//   General School   — app account with a GeneralSchool row
//   Olympiad School  — the app account of an Olympiad School (schoolRef); the
//                      school also gets the message in its web School Panel bell
//
// Where a user's state / district come from:
//   Olympiad Student — the school of their Olympiad ID (which also gives the class)
//   Olympiad School  — the School row
//   General School   — the GeneralSchool row
//   General User     — only the school they have joined (an approved school
//                      link). Without one they have no place, so a state /
//                      district filter leaves them out.
//
// Only accounts that exist when the message is sent receive it; accounts
// pending deletion and switched-off schools are skipped.

const CHUNK = 1000;

const eqAny = (field: 'state' | 'district', values: string[]) =>
  ({ OR: values.map((v) => ({ [field]: { equals: v, mode: 'insensitive' as const } })) });

/** Prisma condition on a School / GeneralSchool row's state and district. */
function placeWhere(f: AnnouncementFilters) {
  const and: object[] = [];
  if (f.states.length) and.push(eqAny('state', f.states));
  if (f.districts.length) and.push(eqAny('district', f.districts));
  return and.length ? { AND: and } : {};
}

const hasPlace = (f: AnnouncementFilters) => f.states.length > 0 || f.districts.length > 0;

async function inChunks<T>(values: string[], run: (chunk: string[]) => Promise<T[]>): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < values.length; i += 5000) out.push(...(await run(values.slice(i, i + 5000))));
  return out;
}

export interface Recipients {
  /** App accounts per type. */
  byType: Record<AnnouncementType, string[]>;
  /** Every app account, once. */
  appUserIds: string[];
  /** Olympiad schools for the web School Panel bell. */
  schoolIds: string[];
}

/** Everyone the filters reach. */
export async function resolveRecipients(f: AnnouncementFilters): Promise<Recipients> {
  const want = new Set(f.types);
  const userBase = { deletionRequestedAt: null, accountType: { not: 'SCHOOL' } };
  const empty = async () => [] as string[];

  const [normal, students, generalSchools, olympiadSchools, webSchools] = await Promise.all([
    // General users
    !want.has('NORMAL') ? empty() : hasPlace(f)
      ? prisma.schoolLinkRequest.findMany({
          where: { status: 'APPROVED', school: placeWhere(f), appUser: { ...userBase, olympiadId: null } },
          select: { appUserId: true }, distinct: ['appUserId'],
        }).then((rows) => rows.map((r) => r.appUserId))
      : prisma.appUser.findMany({ where: { ...userBase, olympiadId: null }, select: { id: true } })
          .then((rows) => rows.map((r) => r.id)),

    // Olympiad students
    !want.has('OLYMPIAD_STUDENT') ? empty() : (async () => {
      if (!hasPlace(f) && f.classes.length === 0) {
        return (await prisma.appUser.findMany({ where: { ...userBase, olympiadId: { not: null } }, select: { id: true } }))
          .map((r) => r.id);
      }
      const codes = (await prisma.olympiadIdAllocation.findMany({
        where: {
          ...(hasPlace(f) ? { school: placeWhere(f) } : {}),
          ...(f.classes.length ? { classCode: { in: f.classes } } : {}),
        },
        select: { code: true },
      })).map((a) => a.code);
      const users = await inChunks(codes, (chunk) => prisma.appUser.findMany({
        where: { ...userBase, olympiadId: { in: chunk } }, select: { id: true },
      }));
      return users.map((u) => u.id);
    })(),

    // General schools
    !want.has('GENERAL_SCHOOL') ? empty() : prisma.generalSchool.findMany({
      where: { isActive: true, ...placeWhere(f), appUser: { deletionRequestedAt: null } },
      select: { appUserId: true },
    }).then((rows) => rows.map((r) => r.appUserId)),

    // Olympiad schools: their app account…
    !want.has('OLYMPIAD_SCHOOL') ? empty() : prisma.appUser.findMany({
      where: { deletionRequestedAt: null, schoolRef: { isActive: true, ...placeWhere(f) } },
      select: { id: true },
    }).then((rows) => rows.map((r) => r.id)),

    // …and their web School Panel (every active school, with or without an app account).
    !want.has('OLYMPIAD_SCHOOL') ? empty() : prisma.school.findMany({
      where: { isActive: true, ...placeWhere(f) },
      select: { id: true },
    }).then((rows) => rows.map((r) => r.id)),
  ]);

  const byType = { NORMAL: normal, OLYMPIAD_STUDENT: students, GENERAL_SCHOOL: generalSchools, OLYMPIAD_SCHOOL: olympiadSchools };
  return { byType, appUserIds: [...new Set([...normal, ...students, ...generalSchools, ...olympiadSchools])], schoolIds: webSchools };
}

/** States and their districts that the filters can pick from (from the schools on record). */
export async function placeOptions(): Promise<{ state: string; districts: string[] }[]> {
  const [schools, generals] = await Promise.all([
    prisma.school.findMany({ where: { state: { not: null } }, select: { state: true, district: true }, distinct: ['state', 'district'] }),
    prisma.generalSchool.findMany({ select: { state: true, district: true }, distinct: ['state', 'district'] }),
  ]);
  const states = new Map<string, { state: string; districts: Map<string, string> }>();
  for (const r of [...schools, ...generals]) {
    const state = (r.state ?? '').trim();
    if (!state) continue;
    const key = state.toLowerCase();
    if (!states.has(key)) states.set(key, { state, districts: new Map() });
    const district = (r.district ?? '').trim();
    if (district) states.get(key)!.districts.set(district.toLowerCase(), district);
  }
  return [...states.values()]
    .sort((a, b) => a.state.localeCompare(b.state))
    .map((s) => ({ state: s.state, districts: [...s.districts.values()].sort((a, b) => a.localeCompare(b)) }));
}

/** Sends the message. Returns the AppAnnouncement id and how many it reached. */
export async function sendAnnouncement(input: {
  title: string; message: string; link: string | null; filters: AnnouncementFilters;
  sender: { id: string; name: string | null };
}): Promise<{ id: string; appRecipients: number; webRecipients: number } | string> {
  const r = await resolveRecipients(input.filters);
  if (r.appUserIds.length === 0 && r.schoolIds.length === 0) return 'No one matches these filters.';

  const id = randomUUID();
  const createdAt = new Date();
  // The web School Panel can only follow a website link, not an app screen.
  const webLink = input.link && /^https?:\/\//i.test(input.link) ? input.link : null;
  const base = { type: 'ANNOUNCEMENT', title: input.title, message: input.message, broadcastId: id, createdAt };

  const ops = [
    prisma.appAnnouncement.create({
      data: {
        id, title: input.title, message: input.message, link: input.link, filters: input.filters as object,
        appRecipients: r.appUserIds.length, webRecipients: r.schoolIds.length,
        createdBy: input.sender.id, createdByName: input.sender.name, createdAt,
      },
    }),
  ] as any[];
  for (let i = 0; i < r.appUserIds.length; i += CHUNK) {
    ops.push(prisma.notification.createMany({
      data: r.appUserIds.slice(i, i + CHUNK).map((userId) => ({ ...base, userId, link: input.link })),
    }));
  }
  for (let i = 0; i < r.schoolIds.length; i += CHUNK) {
    ops.push(prisma.schoolNotification.createMany({
      data: r.schoolIds.slice(i, i + CHUNK).map((schoolId) => ({ ...base, schoolId, link: webLink, createdBy: input.sender.id })),
    }));
  }
  // All or nothing: a failure part-way never leaves half the users notified.
  await prisma.$transaction(ops);
  return { id, appRecipients: r.appUserIds.length, webRecipients: r.schoolIds.length };
}

/** The latest sent messages with how many have been read. */
export async function announcementHistory(limit = 50) {
  const rows = await prisma.appAnnouncement.findMany({ orderBy: { createdAt: 'desc' }, take: limit });
  const ids = rows.map((r) => r.id);
  const [appRead, webRead] = ids.length
    ? await Promise.all([
        prisma.notification.groupBy({ by: ['broadcastId'], where: { broadcastId: { in: ids }, isRead: true }, _count: { _all: true } }),
        prisma.schoolNotification.groupBy({ by: ['broadcastId'], where: { broadcastId: { in: ids }, readAt: { not: null } }, _count: { _all: true } }),
      ])
    : [[], []];
  const appReadBy = new Map(appRead.map((g) => [g.broadcastId, g._count._all]));
  const webReadBy = new Map(webRead.map((g) => [g.broadcastId, g._count._all]));
  return rows.map((r) => ({
    ...r,
    appRead: appReadBy.get(r.id) ?? 0,
    webRead: webReadBy.get(r.id) ?? 0,
  }));
}

/** "Delete for everyone": removes every copy; the log entry stays, marked recalled. */
export async function recallAnnouncement(id: string, by: string): Promise<string | null> {
  const row = await prisma.appAnnouncement.findUnique({ where: { id }, select: { recalledAt: true } });
  if (!row) return 'Notification not found.';
  if (row.recalledAt) return 'This notification was already deleted.';
  await prisma.$transaction([
    prisma.notification.deleteMany({ where: { broadcastId: id } }),
    prisma.schoolNotification.deleteMany({ where: { broadcastId: id } }),
    prisma.appAnnouncement.update({ where: { id }, data: { recalledAt: new Date(), recalledBy: by } }),
  ]);
  return null;
}
