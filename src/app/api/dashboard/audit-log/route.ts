import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth-guard';
import { getSignedMediaUrl } from '@/lib/s3';

export const dynamic = 'force-dynamic';

// GET /api/dashboard/audit-log — superadmin-only view of every logged
// moderation/evaluation action (who did what, to what, and when).
// Query params: action, actorRole, entityType, entityId, from, to, page, pageSize
export async function GET(request: Request) {
  const { error } = requireRole(request, ['SUPERADMIN']);
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const action     = searchParams.get('action') || undefined;
    const actorRole  = searchParams.get('actorRole') || undefined;
    const entityType = searchParams.get('entityType') || undefined;
    const entityId   = searchParams.get('entityId') || undefined;
    const from       = searchParams.get('from') || undefined;
    const to         = searchParams.get('to') || undefined;
    const page       = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize   = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '25', 10)));

    const where: Record<string, any> = {};
    if (action) where.action = action;
    if (actorRole) where.actorRole = actorRole;
    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }

    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    // ── Resolve who each entry's actor is ─────────────────────────────────
    // actorName is denormalised at write time, but it can't be relied on for
    // display: entries written before that column existed have it null, and
    // the call sites fill it from `email || name`, so even a populated one is
    // often an address rather than a person's name. Looking the actor up by
    // role gives the real name and heals old rows at the same time; the stored
    // actorName stays as the fallback for actors that have since been deleted.
    const idsByRole = (role: string) => [
      ...new Set(logs.filter(l => l.actorRole === role).map(l => l.actorId)),
    ];

    const [moderators, evaluators, reviewers, superAdmins, schools] = await Promise.all([
      prisma.moderator.findMany({
        where: { id: { in: idsByRole('MODERATOR') } },
        select: { id: true, name: true, email: true, moderatorId: true },
      }),
      prisma.talentEvaluator.findMany({
        where: { id: { in: idsByRole('EVALUATOR') } },
        select: { id: true, name: true, email: true, evaluatorId: true },
      }),
      prisma.reviewer.findMany({
        where: { id: { in: idsByRole('REVIEWER') } },
        select: { id: true, name: true, email: true, reviewerId: true },
      }),
      prisma.superAdmin.findMany({
        where: { id: { in: idsByRole('SUPERADMIN') } },
        select: { id: true, name: true, email: true },
      }),
      prisma.school.findMany({
        where: { id: { in: idsByRole('SCHOOL') } },
        select: { id: true, name: true, email: true, schoolId: true },
      }),
    ]);

    const actorMap: Record<string, { name: string; email: string | null; staffId: string | null }> = {};
    for (const m of moderators)  actorMap[m.id] = { name: m.name, email: m.email, staffId: m.moderatorId };
    for (const e of evaluators)  actorMap[e.id] = { name: e.name, email: e.email, staffId: e.evaluatorId };
    for (const r of reviewers)   actorMap[r.id] = { name: r.name, email: r.email, staffId: r.reviewerId };
    for (const a of superAdmins) actorMap[a.id] = { name: a.name, email: a.email, staffId: null };
    for (const sc of schools)    actorMap[sc.id] = { name: sc.name, email: sc.email, staffId: sc.schoolId };

    // ── Attach the clip each entry is about ───────────────────────────────
    // Every action logged so far is video-scoped, and all three entity types
    // ("Video", "VideoEvaluation", "VideoReport") store the *video* id in
    // entityId — so one batched lookup covers the whole page. Entries whose
    // entityId isn't a video (a future non-video action, or a hard-deleted
    // row) simply come back with video: null and render as an id, as before.
    const videoIds = [...new Set(logs.map(l => l.entityId).filter(Boolean))];
    const videos = videoIds.length > 0
      ? await prisma.video.findMany({
          where: { id: { in: videoIds } },
          select: {
            id: true, thumbnailUrl: true, videoUrl: true, caption: true, category: true,
            subCategory: true, status: true, deletedAt: true, appUserId: true,
            student: { select: { name: true } },
          },
        })
      : [];

    // Uploader name, resolved the same way the videos dashboard does it: the
    // app account's olympiad code carries the school's assigned student name,
    // which is far more readable than the generated userId.
    // Includes uploaders named only in a delete entry's snapshot, so a removed
    // clip's row can still name who uploaded it.
    const snapshotAppUserIds = logs.flatMap(l => {
      try {
        const snap = l.previousValue ? JSON.parse(l.previousValue) : null;
        return snap && typeof snap.appUserId === 'string' ? [snap.appUserId] : [];
      } catch { return []; }
    });
    const appUserIds = [...new Set([
      ...videos.map(v => v.appUserId).filter(Boolean) as string[],
      ...snapshotAppUserIds,
    ])];
    const appUsers = appUserIds.length > 0
      ? await prisma.appUser.findMany({
          where: { id: { in: appUserIds } },
          select: { id: true, userId: true, olympiadId: true },
        })
      : [];
    const olympiadCodes = appUsers.map(u => u.olympiadId).filter(Boolean) as string[];
    const allocations = olympiadCodes.length > 0
      ? await prisma.olympiadIdAllocation.findMany({
          where: { code: { in: olympiadCodes } },
          select: { code: true, assignedName: true, school: { select: { name: true } } },
        })
      : [];
    const allocationMap = Object.fromEntries(allocations.map(a => [a.code, a]));
    const appUserMap = Object.fromEntries(appUsers.map(u => {
      const allocation = u.olympiadId ? allocationMap[u.olympiadId] : null;
      return [u.id, {
        name: allocation?.assignedName || u.userId,
        olympiadId: u.olympiadId,
        schoolName: allocation?.school?.name ?? null,
      }];
    }));

    // The bucket is private, so the stored URLs 403 in a browser — both the
    // thumbnail and the clip have to be signed before the row can render or
    // play them. Signed in parallel: it's a local HMAC, not a network call.
    const signedMedia = await Promise.all(videos.map(async v => ({
      id: v.id,
      thumbnailUrl: await getSignedMediaUrl(v.thumbnailUrl),
      videoUrl: await getSignedMediaUrl(v.videoUrl),
    })));
    const signedMap = Object.fromEntries(signedMedia.map(m => [m.id, m]));

    const videoMap = Object.fromEntries(videos.map(v => {
      const appUser = v.appUserId ? appUserMap[v.appUserId] : null;
      return [v.id, {
        id: v.id,
        thumbnailUrl: signedMap[v.id]?.thumbnailUrl ?? v.thumbnailUrl,
        videoUrl: signedMap[v.id]?.videoUrl ?? v.videoUrl,
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

    // A hard-deleted video has no row left to join to, but the delete entry's
    // previousValue snapshot kept its caption, category and uploader — so the
    // row can still say *which* clip was removed instead of just an id. The
    // snapshot has no thumbnail, and the appUserId in it may itself be gone,
    // so this fallback is deliberately partial rather than a full record.
    const snapshotFallback = (log: (typeof logs)[number]) => {
      let snap: any;
      try { snap = log.previousValue ? JSON.parse(log.previousValue) : null; } catch { return null; }
      if (!snap || typeof snap !== 'object') return null;
      if (!snap.caption && !snap.category && !snap.subCategory) return null;

      const appUser = snap.appUserId ? appUserMap[snap.appUserId] : null;
      return {
        id: log.entityId,
        thumbnailUrl: null,
        videoUrl: null,
        caption: snap.caption ?? null,
        category: snap.category ?? null,
        subCategory: snap.subCategory ?? null,
        status: snap.status ?? 'UNKNOWN',
        deleted: true,
        uploaderName: appUser?.name ?? null,
        olympiadId: appUser?.olympiadId ?? null,
        schoolName: appUser?.schoolName ?? null,
        fromSnapshot: true,
      };
    };

    const enriched = logs.map(log => {
      const actor = actorMap[log.actorId] ?? null;
      return {
        ...log,
        // Overridden rather than merged: a resolved actor is always more
        // accurate than the snapshot taken when the row was written.
        actorName: actor?.name ?? log.actorName,
        actorEmail: actor?.email ?? null,
        actorStaffId: actor?.staffId ?? null,
        video: videoMap[log.entityId] ?? snapshotFallback(log),
      };
    });

    return NextResponse.json({
      logs: enriched,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    });
  } catch (error) {
    console.error('GET dashboard/audit-log failed:', error);
    return NextResponse.json({ message: 'Failed to fetch audit log' }, { status: 500 });
  }
}
