// Server-only helpers behind the Activity Log lookup. Each lookup mode turns a
// subject (a staff member, a student, a school, a video or an action type)
// into a scoped AuditLog filter, so a report only ever reads that subject's
// rows instead of the whole table.

import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getSignedMediaUrl } from '@/lib/s3';
import {
  AUDIT_ACTIONS, AUDIT_CATEGORIES, ACTOR_ROLE_LABELS, actionsInCategory,
  type AuditCategory, type AuditLookupMode,
} from '@/lib/audit-actions';

export interface AuditSubject {
  mode: AuditLookupMode;
  ref: string;
  name: string;
  /** Secondary line: role, staff id, Olympiad ID, school, … */
  sub: string | null;
  badge: string;
  thumbnailUrl?: string | null;
}

export interface SubjectOption {
  ref: string;
  name: string;
  sub: string | null;
  badge: string;
}

// ─── Typeahead ──────────────────────────────────────────────────────────────

const ci = (q: string) => ({ contains: q, mode: 'insensitive' as const });

// The MasterAdmin table may not exist yet on a database that hasn't had the
// 2026-10-15 migration; a lookup shouldn't fail because of it.
async function safe<T>(p: Promise<T[]>): Promise<T[]> {
  try { return await p; } catch { return []; }
}

export async function searchSubjects(type: AuditLookupMode, q: string): Promise<SubjectOption[]> {
  if (type === 'staff') {
    const take = 5;
    const [admins, masters, moderators, evaluators, reviewers, masterReviewers] = await Promise.all([
      safe(prisma.superAdmin.findMany({ where: { OR: [{ name: ci(q) }, { email: ci(q) }] }, select: { id: true, name: true, email: true }, take })),
      safe(prisma.masterAdmin.findMany({ where: { OR: [{ name: ci(q) }, { username: ci(q) }, { email: ci(q) }] }, select: { id: true, name: true, username: true }, take })),
      safe(prisma.moderator.findMany({ where: { OR: [{ name: ci(q) }, { email: ci(q) }, { moderatorId: ci(q) }] }, select: { id: true, name: true, moderatorId: true }, take })),
      safe(prisma.talentEvaluator.findMany({ where: { OR: [{ name: ci(q) }, { email: ci(q) }, { evaluatorId: ci(q) }] }, select: { id: true, name: true, evaluatorId: true }, take })),
      safe(prisma.reviewer.findMany({ where: { OR: [{ name: ci(q) }, { email: ci(q) }, { reviewerId: ci(q) }] }, select: { id: true, name: true, reviewerId: true }, take })),
      safe(prisma.masterReviewer.findMany({ where: { OR: [{ name: ci(q) }, { email: ci(q) }, { masterReviewerId: ci(q) }] }, select: { id: true, name: true, masterReviewerId: true }, take })),
    ]);
    const out: SubjectOption[] = [
      ...admins.map((a) => ({ ref: a.id, name: a.name, sub: a.email, badge: 'Super Admin' })),
      ...masters.map((a) => ({ ref: a.id, name: a.name, sub: a.username, badge: 'Master Admin' })),
      ...moderators.map((m) => ({ ref: m.id, name: m.name, sub: m.moderatorId, badge: 'Moderator' })),
      ...evaluators.map((e) => ({ ref: e.id, name: e.name, sub: e.evaluatorId, badge: 'Evaluator' })),
      ...reviewers.map((r) => ({ ref: r.id, name: r.name, sub: r.reviewerId, badge: 'Reviewer' })),
      ...masterReviewers.map((r) => ({ ref: r.id, name: r.name, sub: r.masterReviewerId, badge: 'Master Reviewer' })),
    ];
    // An admin who has evaluated videos also has a shadow evaluator row with
    // the same id — list the person once, under their admin role.
    const seen = new Set<string>();
    return out.filter((o) => (seen.has(o.ref) ? false : (seen.add(o.ref), true)));
  }

  if (type === 'student') {
    const take = 8;
    const upper = q.toUpperCase();
    const digits = q.replace(/\D/g, '');
    const [allocations, students, appUsers] = await Promise.all([
      prisma.olympiadIdAllocation.findMany({
        where: { OR: [{ code: ci(q) }, { assignedName: ci(q) }] },
        select: { code: true, assignedName: true, className: true, school: { select: { name: true } } },
        take,
      }),
      prisma.student.findMany({
        where: { OR: [{ name: ci(q) }, { olympiadCode: ci(q) }] },
        select: { olympiadCode: true, name: true },
        take: 5,
      }),
      prisma.appUser.findMany({
        where: {
          OR: [
            { userId: ci(q) },
            { childName: ci(q) },
            { olympiadId: upper },
            ...(digits.length >= 5 ? [{ mobile: { contains: digits } }] : []),
          ],
        },
        select: { id: true, userId: true, olympiadId: true, childName: true, accountType: true },
        take,
      }),
    ]);

    const byRef = new Map<string, SubjectOption>();
    for (const a of allocations) {
      byRef.set(`code:${a.code}`, {
        ref: `code:${a.code}`,
        name: a.assignedName || 'Unassigned ID',
        sub: [a.code, a.className, a.school?.name].filter(Boolean).join(' · '),
        badge: 'Olympiad Student',
      });
    }
    for (const s of students) {
      const ref = `code:${s.olympiadCode}`;
      if (!byRef.has(ref)) byRef.set(ref, { ref, name: s.name, sub: s.olympiadCode, badge: 'Olympiad Student' });
    }
    for (const u of appUsers) {
      const ref = u.olympiadId ? `code:${u.olympiadId}` : `app:${u.id}`;
      if (byRef.has(ref)) continue;
      byRef.set(ref, {
        ref,
        name: u.childName || u.userId,
        sub: [u.userId, u.olympiadId].filter(Boolean).join(' · '),
        badge: u.olympiadId ? 'Olympiad Student' : 'App User',
      });
    }
    return [...byRef.values()].slice(0, 12);
  }

  if (type === 'school') {
    const take = 8;
    const [schools, generals] = await Promise.all([
      prisma.school.findMany({
        where: { OR: [{ name: ci(q) }, { schoolId: ci(q) }, { olympiadId: ci(q) }, { city: ci(q) }] },
        select: { id: true, name: true, schoolId: true, city: true },
        take,
      }),
      prisma.generalSchool.findMany({
        where: { OR: [{ name: ci(q) }, { email: ci(q) }, { district: ci(q) }] },
        select: { id: true, name: true, district: true, state: true },
        take: 5,
      }),
    ]);
    return [
      ...schools.map((s) => ({ ref: `school:${s.id}`, name: s.name, sub: [s.schoolId, s.city].filter(Boolean).join(' · '), badge: 'Olympiad School' })),
      ...generals.map((g) => ({ ref: `general:${g.id}`, name: g.name, sub: [g.district, g.state].filter(Boolean).join(', '), badge: 'General School' })),
    ];
  }

  return [];
}

// ─── Resolve a subject into a scoped filter ─────────────────────────────────

const mentions = (ids: string[]): Prisma.AuditLogWhereInput[] =>
  // List views (recordAccessLog) keep the people they showed in newValue's
  // subjectIds, so "who saw this student's data" has to look inside it.
  ids.map((id) => ({ newValue: { contains: id } }));

export async function resolveSubject(
  mode: AuditLookupMode,
  ref: string,
): Promise<{ subject: AuditSubject; where: Prisma.AuditLogWhereInput } | null> {
  if (mode === 'staff') {
    const id = ref;
    const [admin, master, moderator, evaluator, reviewer, masterReviewer] = await Promise.all([
      prisma.superAdmin.findUnique({ where: { id }, select: { name: true, email: true } }),
      prisma.masterAdmin.findUnique({ where: { id }, select: { name: true, username: true } }).catch(() => null),
      prisma.moderator.findUnique({ where: { id }, select: { name: true, moderatorId: true } }),
      prisma.talentEvaluator.findUnique({ where: { id }, select: { name: true, evaluatorId: true } }),
      prisma.reviewer.findUnique({ where: { id }, select: { name: true, reviewerId: true } }),
      prisma.masterReviewer.findUnique({ where: { id }, select: { name: true, masterReviewerId: true } }),
    ]);
    const found =
      (admin && { name: admin.name, sub: admin.email, badge: 'Super Admin' }) ||
      (master && { name: master.name, sub: master.username, badge: 'Master Admin' }) ||
      (moderator && { name: moderator.name, sub: moderator.moderatorId, badge: 'Moderator' }) ||
      (evaluator && { name: evaluator.name, sub: evaluator.evaluatorId, badge: 'Evaluator' }) ||
      (reviewer && { name: reviewer.name, sub: reviewer.reviewerId, badge: 'Reviewer' }) ||
      (masterReviewer && { name: masterReviewer.name, sub: masterReviewer.masterReviewerId, badge: 'Master Reviewer' });
    if (!found) {
      // A deleted staff member's rows are still in the log under their id.
      const last = await prisma.auditLog.findFirst({ where: { actorId: id }, orderBy: { createdAt: 'desc' }, select: { actorName: true, actorRole: true } });
      if (!last) return null;
      return {
        subject: { mode, ref, name: last.actorName || 'Removed account', sub: 'Account no longer exists', badge: ACTOR_ROLE_LABELS[last.actorRole] ?? last.actorRole },
        where: { actorId: id },
      };
    }
    return { subject: { mode, ref, ...found }, where: { actorId: id } };
  }

  if (mode === 'student') {
    const [kind, value] = [ref.slice(0, ref.indexOf(':')), ref.slice(ref.indexOf(':') + 1)];
    if (!value) return null;

    let code: string | null = kind === 'code' ? value : null;
    let appUsers: { id: string; userId: string; childName: string | null; olympiadId: string | null }[] = [];
    if (kind === 'app') {
      const u = await prisma.appUser.findUnique({ where: { id: value }, select: { id: true, userId: true, childName: true, olympiadId: true } });
      if (!u) return null;
      appUsers = [u];
      code = u.olympiadId;
    } else if (kind !== 'code') {
      return null;
    }

    const allocation = code
      ? await prisma.olympiadIdAllocation.findUnique({
          where: { code },
          select: { id: true, code: true, assignedName: true, className: true, school: { select: { name: true } }, student: { select: { id: true, name: true } } },
        })
      : null;
    if (code && kind === 'code') {
      appUsers = await prisma.appUser.findMany({ where: { olympiadId: code }, select: { id: true, userId: true, childName: true, olympiadId: true }, take: 5 });
    }
    if (!allocation && appUsers.length === 0) return null;

    const appUserIds = appUsers.map((u) => u.id);
    const studentId = allocation?.student?.id ?? null;
    const videoOr: Prisma.VideoWhereInput[] = [];
    if (appUserIds.length) videoOr.push({ appUserId: { in: appUserIds } });
    if (studentId) videoOr.push({ studentId });
    const videos = videoOr.length
      ? await prisma.video.findMany({ where: { OR: videoOr }, select: { id: true }, take: 1000 })
      : [];

    const personIds = [...appUserIds, ...(studentId ? [studentId] : []), ...(allocation ? [allocation.id] : [])];
    const name = allocation?.assignedName || allocation?.student?.name || appUsers[0]?.childName || appUsers[0]?.userId || 'Student';
    return {
      subject: {
        mode, ref, name,
        sub: [allocation?.code ?? appUsers[0]?.userId, allocation?.className, allocation?.school?.name].filter(Boolean).join(' · ') || null,
        badge: allocation ? 'Olympiad Student' : 'App User',
      },
      where: {
        OR: [
          { entityId: { in: [...personIds, ...videos.map((v) => v.id)] } },
          ...mentions(personIds),
        ],
      },
    };
  }

  if (mode === 'school') {
    const [kind, id] = [ref.slice(0, ref.indexOf(':')), ref.slice(ref.indexOf(':') + 1)];
    if (kind === 'school') {
      const school = await prisma.school.findUnique({
        where: { id },
        select: { id: true, name: true, schoolId: true, city: true, appAccount: { select: { id: true } } },
      });
      if (!school) return null;
      const tickets = await prisma.schoolSupportTicket.findMany({ where: { schoolId: id }, select: { id: true }, take: 500 });
      const ids = [school.id, ...(school.appAccount ? [school.appAccount.id] : [])];
      return {
        subject: { mode, ref, name: school.name, sub: [school.schoolId, school.city].filter(Boolean).join(' · '), badge: 'Olympiad School' },
        where: {
          OR: [
            { entityId: { in: [...ids, ...tickets.map((t) => t.id)] } },
            // What the school itself did from its own panel.
            { actorId: school.id },
            ...mentions(ids),
          ],
        },
      };
    }
    if (kind === 'general') {
      const g = await prisma.generalSchool.findUnique({ where: { id }, select: { id: true, name: true, appUserId: true, district: true, state: true } });
      if (!g) return null;
      return {
        subject: { mode, ref, name: g.name, sub: [g.district, g.state].filter(Boolean).join(', '), badge: 'General School' },
        where: { OR: [{ entityId: { in: [g.id, g.appUserId] } }, { actorId: g.appUserId }, ...mentions([g.appUserId])] },
      };
    }
    return null;
  }

  if (mode === 'video') {
    const id = ref.trim();
    const [video, notices, anyLog] = await Promise.all([
      prisma.video.findUnique({
        where: { id },
        select: { caption: true, category: true, subCategory: true, thumbnailUrl: true, status: true, deletedAt: true, student: { select: { name: true } } },
      }),
      prisma.infringementNotice.findMany({ where: { videoId: id }, select: { id: true }, take: 50 }),
      prisma.auditLog.findFirst({ where: { entityId: id }, select: { id: true } }),
    ]);
    // A hard-deleted clip has no row left, but its history is still in the log.
    if (!video && !anyLog) return null;
    const title = video
      ? video.caption?.trim() || [video.category, video.subCategory].filter(Boolean).join(' · ') || 'Untitled clip'
      : 'Deleted video';
    return {
      subject: {
        mode, ref: id, name: title,
        sub: video ? [video.student?.name, video.deletedAt ? 'Deleted' : video.status].filter(Boolean).join(' · ') : 'No longer in the system',
        badge: 'Video',
        thumbnailUrl: video?.thumbnailUrl ? await getSignedMediaUrl(video.thumbnailUrl) : null,
      },
      where: { entityId: { in: [id, ...notices.map((n) => n.id)] } },
    };
  }

  if (mode === 'action') {
    const category = AUDIT_CATEGORIES.find((c) => c.key === ref);
    if (category) {
      return {
        subject: { mode, ref, name: category.label, sub: category.hint, badge: 'Activity type' },
        where: { action: { in: actionsInCategory(category.key as AuditCategory) } },
      };
    }
    const def = AUDIT_ACTIONS[ref];
    if (!def) return null;
    return {
      subject: { mode, ref, name: def.label, sub: AUDIT_CATEGORIES.find((c) => c.key === def.category)?.label ?? null, badge: 'Activity type' },
      where: { action: ref },
    };
  }

  return null;
}

// ─── Make each row readable ─────────────────────────────────────────────────

type LogRow = Prisma.AuditLogGetPayload<object>;

export interface LogTarget {
  kind: string;
  name: string | null;
  sub: string | null;
  /** For list views: how many records were shown. */
  count?: number;
}

const ENTITY_LABELS: Record<string, string> = {
  AppUser: 'App user', Student: 'Student', School: 'School', GeneralSchool: 'General school',
  MasterAdmin: 'Master Admin', Moderator: 'Moderator', TalentEvaluator: 'Evaluator', Reviewer: 'Reviewer',
  MasterReviewer: 'Master Reviewer', Uploader: 'Uploader', Viewer: 'Viewer',
  OlympiadIdAllocation: 'Olympiad ID', InfringementNotice: 'Copyright notice',
  SchoolSupportTicket: 'Support ticket', AccountDeletionRequest: 'Deletion request',
  AgreementAcceptance: 'Agreement', Video: 'Video', VideoEvaluation: 'Video', VideoReport: 'Video',
};

const VIDEO_TYPES = new Set(['Video', 'VideoEvaluation', 'VideoReport']);

/**
 * Attaches the actor's current name, the clip (for video entries) and a
 * readable target (for everything else) to one page of rows. All lookups are
 * batched per table, so a page costs a fixed handful of queries.
 * `signMedia: false` skips URL signing for CSV exports, which never show media.
 */
export async function enrichLogs(logs: LogRow[], { signMedia = true } = {}) {
  const idsWhere = (pred: (l: LogRow) => boolean, pick: (l: LogRow) => string = (l) => l.entityId) =>
    [...new Set(logs.filter(pred).map(pick).filter(Boolean))];
  const actorIds = (role: string) => idsWhere((l) => l.actorRole === role, (l) => l.actorId);
  const entityIds = (type: string) => idsWhere((l) => l.entityType === type && l.entityId !== 'LIST');
  const none = <T,>() => Promise.resolve([] as T[]);

  // ── Actors ──
  const [moderators, evaluators, reviewers, masterReviewers, superAdmins, masterAdmins, schools] = await Promise.all([
    prisma.moderator.findMany({ where: { id: { in: actorIds('MODERATOR') } }, select: { id: true, name: true, email: true, moderatorId: true } }),
    prisma.talentEvaluator.findMany({ where: { id: { in: actorIds('EVALUATOR') } }, select: { id: true, name: true, email: true, evaluatorId: true } }),
    prisma.reviewer.findMany({ where: { id: { in: actorIds('REVIEWER') } }, select: { id: true, name: true, email: true, reviewerId: true } }),
    prisma.masterReviewer.findMany({ where: { id: { in: actorIds('REVIEWER') } }, select: { id: true, name: true, email: true, masterReviewerId: true } }),
    prisma.superAdmin.findMany({ where: { id: { in: actorIds('SUPERADMIN') } }, select: { id: true, name: true, email: true } }),
    safe(prisma.masterAdmin.findMany({ where: { id: { in: actorIds('MASTER_ADMIN') } }, select: { id: true, name: true, email: true, username: true } })),
    prisma.school.findMany({ where: { id: { in: actorIds('SCHOOL') } }, select: { id: true, name: true, email: true, schoolId: true } }),
  ]);
  const actorMap: Record<string, { name: string; email: string | null; staffId: string | null }> = {};
  for (const m of moderators)      actorMap[m.id] = { name: m.name, email: m.email, staffId: m.moderatorId };
  for (const e of evaluators)      actorMap[e.id] = { name: e.name, email: e.email, staffId: e.evaluatorId };
  for (const r of reviewers)       actorMap[r.id] = { name: r.name, email: r.email, staffId: r.reviewerId };
  for (const r of masterReviewers) actorMap[r.id] = { name: r.name, email: r.email, staffId: r.masterReviewerId };
  for (const a of superAdmins)     actorMap[a.id] = { name: a.name, email: a.email, staffId: null };
  for (const a of masterAdmins)    actorMap[a.id] = { name: a.name, email: a.email, staffId: a.username };
  for (const sc of schools)        actorMap[sc.id] = { name: sc.name, email: sc.email, staffId: sc.schoolId };

  // ── Videos ──
  // All three video entity types store the *video* id in entityId.
  const videoIds = idsWhere((l) => VIDEO_TYPES.has(l.entityType));
  const videos = videoIds.length
    ? await prisma.video.findMany({
        where: { id: { in: videoIds } },
        select: {
          id: true, thumbnailUrl: true, videoUrl: true, caption: true, category: true,
          subCategory: true, status: true, deletedAt: true, appUserId: true,
          student: { select: { name: true } },
        },
      })
    : [];

  // Uploader name the way the videos dashboard resolves it: the app account's
  // olympiad code carries the school's assigned student name. Includes
  // uploaders named only in a delete entry's snapshot.
  const snapshotAppUserIds = logs.flatMap((l) => {
    try {
      const snap = l.previousValue ? JSON.parse(l.previousValue) : null;
      return snap && typeof snap.appUserId === 'string' ? [snap.appUserId] : [];
    } catch { return []; }
  });
  const appUserIds = [...new Set([
    ...(videos.map((v) => v.appUserId).filter(Boolean) as string[]),
    ...snapshotAppUserIds,
    ...entityIds('AppUser'),
  ])];

  // ── Other targets ──
  const [appUsers, students, schoolTargets, generalSchools, masterAdminTargets, modTargets, evalTargets,
    reviewerTargets, masterReviewerTargets, uploaders, viewers, allocations, notices, tickets, deletionRequests, agreements] = await Promise.all([
    appUserIds.length ? prisma.appUser.findMany({ where: { id: { in: appUserIds } }, select: { id: true, userId: true, olympiadId: true, childName: true } }) : none<any>(),
    prisma.student.findMany({ where: { id: { in: entityIds('Student') } }, select: { id: true, name: true, olympiadCode: true } }),
    prisma.school.findMany({ where: { id: { in: entityIds('School') } }, select: { id: true, name: true, schoolId: true } }),
    prisma.generalSchool.findMany({ where: { id: { in: entityIds('GeneralSchool') } }, select: { id: true, name: true, district: true } }),
    safe(prisma.masterAdmin.findMany({ where: { id: { in: entityIds('MasterAdmin') } }, select: { id: true, name: true, username: true } })),
    prisma.moderator.findMany({ where: { id: { in: entityIds('Moderator') } }, select: { id: true, name: true, moderatorId: true } }),
    prisma.talentEvaluator.findMany({ where: { id: { in: entityIds('TalentEvaluator') } }, select: { id: true, name: true, evaluatorId: true } }),
    prisma.reviewer.findMany({ where: { id: { in: entityIds('Reviewer') } }, select: { id: true, name: true, reviewerId: true } }),
    prisma.masterReviewer.findMany({ where: { id: { in: entityIds('MasterReviewer') } }, select: { id: true, name: true, masterReviewerId: true } }),
    prisma.uploader.findMany({ where: { id: { in: entityIds('Uploader') } }, select: { id: true, name: true, uploaderId: true } }),
    prisma.viewer.findMany({ where: { id: { in: entityIds('Viewer') } }, select: { id: true, name: true, email: true } }),
    prisma.olympiadIdAllocation.findMany({ where: { id: { in: entityIds('OlympiadIdAllocation') } }, select: { id: true, code: true, assignedName: true } }),
    prisma.infringementNotice.findMany({ where: { id: { in: entityIds('InfringementNotice') } }, select: { id: true, referenceId: true, fullName: true } }),
    prisma.schoolSupportTicket.findMany({ where: { id: { in: entityIds('SchoolSupportTicket') } }, select: { id: true, ticketNo: true, subject: true, school: { select: { name: true } } } }),
    prisma.accountDeletionRequest.findMany({ where: { id: { in: entityIds('AccountDeletionRequest') } }, select: { id: true, appUser: { select: { userId: true, olympiadId: true, childName: true } } } }),
    prisma.agreementAcceptance.findMany({ where: { id: { in: entityIds('AgreementAcceptance') } }, select: { id: true, actorName: true, documentKey: true } }),
  ]);

  const olympiadCodes = (appUsers as { olympiadId: string | null }[]).map((u) => u.olympiadId).filter(Boolean) as string[];
  const codeAllocations = olympiadCodes.length
    ? await prisma.olympiadIdAllocation.findMany({ where: { code: { in: olympiadCodes } }, select: { code: true, assignedName: true, school: { select: { name: true } } } })
    : [];
  const allocationByCode = Object.fromEntries(codeAllocations.map((a) => [a.code, a]));
  const appUserMap = Object.fromEntries((appUsers as { id: string; userId: string; olympiadId: string | null; childName: string | null }[]).map((u) => {
    const allocation = u.olympiadId ? allocationByCode[u.olympiadId] : null;
    return [u.id, { name: allocation?.assignedName || u.childName || u.userId, olympiadId: u.olympiadId, userId: u.userId, schoolName: allocation?.school?.name ?? null }];
  }));

  const targetMap: Record<string, { name: string | null; sub: string | null }> = {};
  for (const [id, u] of Object.entries(appUserMap)) targetMap[id] = { name: u.name, sub: [u.olympiadId ?? u.userId, u.schoolName].filter(Boolean).join(' · ') };
  for (const s of students) targetMap[s.id] = { name: s.name, sub: s.olympiadCode };
  for (const s of schoolTargets) targetMap[s.id] = { name: s.name, sub: s.schoolId };
  for (const g of generalSchools) targetMap[g.id] = { name: g.name, sub: g.district };
  for (const m of masterAdminTargets) targetMap[m.id] = { name: m.name, sub: m.username };
  for (const m of modTargets) targetMap[m.id] = { name: m.name, sub: m.moderatorId };
  for (const e of evalTargets) targetMap[e.id] = { name: e.name, sub: e.evaluatorId };
  for (const r of reviewerTargets) targetMap[r.id] = { name: r.name, sub: r.reviewerId };
  for (const r of masterReviewerTargets) targetMap[r.id] = { name: r.name, sub: r.masterReviewerId };
  for (const u of uploaders) targetMap[u.id] = { name: u.name, sub: u.uploaderId };
  for (const v of viewers) targetMap[v.id] = { name: v.name || v.email, sub: null };
  for (const a of allocations) targetMap[a.id] = { name: a.assignedName, sub: a.code };
  for (const n of notices) targetMap[n.id] = { name: n.referenceId, sub: n.fullName };
  for (const t of tickets) targetMap[t.id] = { name: `#${t.ticketNo} ${t.subject}`, sub: t.school?.name ?? null };
  for (const d of deletionRequests) targetMap[d.id] = { name: d.appUser?.childName || d.appUser?.userId || null, sub: d.appUser?.olympiadId ?? null };
  for (const a of agreements) targetMap[a.id] = { name: a.actorName, sub: a.documentKey };

  const signed = signMedia
    ? Object.fromEntries(await Promise.all(videos.map(async (v) => [v.id, {
        thumbnailUrl: await getSignedMediaUrl(v.thumbnailUrl),
        videoUrl: await getSignedMediaUrl(v.videoUrl),
      }] as const)))
    : {};

  const videoMap = Object.fromEntries(videos.map((v) => {
    const appUser = v.appUserId ? appUserMap[v.appUserId] : null;
    return [v.id, {
      id: v.id,
      thumbnailUrl: signMedia ? signed[v.id]?.thumbnailUrl ?? null : null,
      videoUrl: signMedia ? signed[v.id]?.videoUrl ?? null : null,
      caption: v.caption,
      category: v.category,
      subCategory: v.subCategory,
      status: v.status,
      deleted: Boolean(v.deletedAt),
      uploaderName: appUser?.name || v.student?.name || null,
      olympiadId: appUser?.olympiadId ?? null,
      schoolName: appUser?.schoolName ?? null,
    }];
  }));

  // A hard-deleted video has no row left, but the delete entry's snapshot
  // kept its caption, category and uploader.
  const snapshotFallback = (log: LogRow) => {
    let snap: any;
    try { snap = log.previousValue ? JSON.parse(log.previousValue) : null; } catch { return null; }
    if (!snap || typeof snap !== 'object') return null;
    if (!snap.caption && !snap.category && !snap.subCategory) return null;
    const appUser = snap.appUserId ? appUserMap[snap.appUserId] : null;
    return {
      id: log.entityId, thumbnailUrl: null, videoUrl: null,
      caption: snap.caption ?? null, category: snap.category ?? null, subCategory: snap.subCategory ?? null,
      status: snap.status ?? 'UNKNOWN', deleted: true,
      uploaderName: appUser?.name ?? null, olympiadId: appUser?.olympiadId ?? null, schoolName: appUser?.schoolName ?? null,
      fromSnapshot: true,
    };
  };

  return logs.map((log) => {
    const actor = actorMap[log.actorId] ?? null;
    const isVideo = VIDEO_TYPES.has(log.entityType);
    let target: LogTarget | null = null;
    if (!isVideo) {
      const kind = ENTITY_LABELS[log.entityType] ?? log.entityType;
      if (log.entityId === 'LIST') {
        let count: number | undefined;
        try { count = JSON.parse(log.newValue || '{}').count; } catch { /* keep undefined */ }
        target = { kind, name: null, sub: null, count };
      } else {
        target = { kind, name: targetMap[log.entityId]?.name ?? null, sub: targetMap[log.entityId]?.sub ?? null };
      }
    }
    return {
      ...log,
      // A resolved actor is more accurate than the name stored at write time.
      actorName: actor?.name ?? log.actorName,
      actorEmail: actor?.email ?? null,
      actorStaffId: actor?.staffId ?? null,
      video: isVideo ? videoMap[log.entityId] ?? snapshotFallback(log) : null,
      target,
    };
  });
}
