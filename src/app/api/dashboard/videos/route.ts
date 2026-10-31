import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole, requireModule, requireAdmin } from '@/lib/auth-guard';
import { recordAuditLog } from '@/lib/audit-log';
import { createNotification, notifyFollowersOfNewVideo } from '@/lib/notifications';
import { ensureSchoolAccount } from '@/lib/schoolAccount';
import { OLYMPIAD_CAT_A_LABEL, OLYMPIAD_CAT_B_LABEL, OLYMPIAD_CAT_A_SUBS, OLYMPIAD_CAT_B_SUBS } from '@/lib/olympiad-categories';
import { currentGroupLabel, isAllowedCategory } from '@/lib/moderationCategories';
import { CLEAR_CLAIM, claimFreeFor, claimIsLive } from '@/lib/videoClaim';
import { mergeTags, schoolAutoTags, videoDefaultTags, withoutCategoryTags } from '@/lib/videoAutoTags';
import { MAX_CAPTION_LENGTH, MAX_CUSTOM_TAGS, cleanHashtag } from '@/lib/uploadRules';
import { captionTagsAbuseMessage } from '@/lib/profanity';

const TAG_SCHOOL_SELECT = { name: true, state: true, district: true, olympiadId: true } as const;

// The student's school, through their web Student row or their app account's
// Olympiad ID. A school's own uploads and ordinary viewers have none, so their
// tags stay fully editable.
async function schoolTagsForVideo(video: { studentId: string | null; appUserId: string | null }): Promise<string[]> {
  if (video.studentId) {
    const student = await prisma.student.findUnique({
      where: { id: video.studentId },
      select: { allocation: { select: { school: { select: TAG_SCHOOL_SELECT } } } },
    });
    return schoolAutoTags(student?.allocation?.school);
  }
  if (video.appUserId) {
    const user = await prisma.appUser.findUnique({ where: { id: video.appUserId }, select: { olympiadId: true } });
    if (!user?.olympiadId) return [];
    const allocation = await prisma.olympiadIdAllocation.findUnique({
      where: { code: user.olympiadId },
      select: { school: { select: TAG_SCHOOL_SELECT } },
    });
    return schoolAutoTags(allocation?.school);
  }
  return [];
}

// Default tags (school + current main category) always lead and can't be
// dropped; a main-category tag left over from an older category is replaced.
async function tagsWithDefaults(
  video: { studentId: string | null; appUserId: string | null; isEvaluation: boolean; category: string | null; subCategory: string | null },
  tags: string[],
): Promise<string> {
  const defaults = videoDefaultTags(await schoolTagsForVideo(video), video);
  return mergeTags(defaults, video.isEvaluation ? withoutCategoryTags(tags) : tags);
}

const splitTags = (tags: string | null) => (tags || '').split(',').map(t => t.trim()).filter(Boolean);

export const dynamic = 'force-dynamic';

const STATUSES = ['PENDING', 'APPROVED', 'REJECTED'];

/**
 * Why a moderation write didn't land: someone else is reviewing the video
 * (live claim) or already decided it. Names the other moderator where known so
 * the reader isn't left guessing whose call stands.
 */
async function moderationConflict(videoId: string, userId: string) {
  const v = await prisma.video.findUnique({
    where: { id: videoId },
    select: { status: true, deletedAt: true, claimedById: true, claimedByName: true, claimedAt: true },
  });
  if (!v || v.deletedAt) {
    return NextResponse.json({ message: 'This video no longer exists.' }, { status: 404 });
  }
  if (v.claimedById && v.claimedById !== userId && claimIsLive(v.claimedAt)) {
    return NextResponse.json(
      { message: `${v.claimedByName || 'Another moderator'} is reviewing this video right now.`, currentStatus: v.status },
      { status: 409 },
    );
  }
  const last = await prisma.auditLog.findFirst({
    where: { entityType: 'Video', entityId: videoId, action: { in: ['VIDEO_APPROVED', 'VIDEO_REJECTED'] } },
    orderBy: { createdAt: 'desc' },
    select: { actorName: true },
  });
  return NextResponse.json(
    {
      message: `This video was already ${v.status.toLowerCase()}${last?.actorName ? ` by ${last.actorName}` : ''}. The list has been refreshed.`,
      currentStatus: v.status,
    },
    { status: 409 },
  );
}

type StatusNotifyVideo = {
  id: string; appUserId: string | null; uploadedBySchoolId: string | null;
  caption: string | null; category: string | null; subCategory: string | null;
};

// Tells the student (when they have an app account) and, for a video a school
// uploaded on their behalf, that school too. A video the student uploaded
// themselves only ever notifies the student.
async function notifyVideoStatus(
  video: StatusNotifyVideo,
  status: 'APPROVED' | 'REJECTED',
  rejectionReason?: string | null,
) {
  if (video.appUserId) {
    await createNotification(buildVideoStatusNotification(video, status, rejectionReason));
  }
  if (!video.uploadedBySchoolId) return;

  try {
    const school = await prisma.school.findUnique({
      where: { id: video.uploadedBySchoolId },
      select: { id: true, username: true, schoolId: true, name: true },
    });
    if (!school) return;
    const account = await ensureSchoolAccount(school);

    const label = video.caption?.trim() || video.subCategory || video.category || 'the video';
    await createNotification(status === 'APPROVED'
      ? {
          userId:  account.id,
          type:    'VIDEO_APPROVED',
          title:   'Video Approved',
          message: `The video "${label}" you uploaded for your student has been approved and is now live!`,
          videoId: video.id,
        }
      : {
          userId:  account.id,
          type:    'VIDEO_REJECTED',
          title:   'Video Rejected',
          message: rejectionReason
            ? `The video "${label}" you uploaded for your student was not approved. Reason: ${rejectionReason}`
            : `The video "${label}" you uploaded for your student was not approved.`,
          videoId: video.id,
        });
  } catch (error) {
    console.error('Failed to notify school of video status:', error);
  }
}

// An approved video can be pulled back (rejected) only while no evaluator has
// scored it — see the un-approve guard in POST.
const NOT_EVALUATED = { evaluations: { none: {} } };

function evaluatedConflict() {
  return NextResponse.json(
    { message: 'This video has already been evaluated by the jury, so it can no longer be rejected.', currentStatus: 'APPROVED' },
    { status: 409 },
  );
}

function buildVideoStatusNotification(
  video: { id: string; appUserId: string | null; caption: string | null; category: string | null; subCategory: string | null },
  status: 'APPROVED' | 'REJECTED',
  rejectionReason?: string | null,
) {
  const label = video.caption?.trim() || video.subCategory || video.category || 'your video';
  return status === 'APPROVED'
    ? {
        userId:  video.appUserId as string,
        type:    'VIDEO_APPROVED',
        title:   'Video Approved',
        message: `Your video "${label}" has been approved and is now live!`,
        videoId: video.id,
      }
    : {
        userId:  video.appUserId as string,
        type:    'VIDEO_REJECTED',
        title:   'Video Rejected',
        message: rejectionReason
          ? `Your video "${label}" was not approved. Reason: ${rejectionReason}`
          : `Your video "${label}" was not approved.`,
        videoId: video.id,
      };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status    = searchParams.get('status');
    const category  = searchParams.get('category') || undefined;
    const uploaderT = searchParams.get('uploaderType') || undefined;
    const search    = searchParams.get('search')?.trim() || undefined;

    // ── Counts for all three statuses (always returned) ──────────────────────
    // User-deleted videos are excluded — they're retained in the DB for
    // SuperAdmin/audit visibility (see /api/app/videos/[id] DELETE) but
    // shouldn't clutter the moderation queue, which only cares about videos
    // still awaiting/holding a moderation decision.
    const [pendingCount, approvedCount, rejectedCount] = await Promise.all([
      prisma.video.count({ where: { status: 'PENDING', deletedAt: null } }),
      prisma.video.count({ where: { status: 'APPROVED', deletedAt: null } }),
      prisma.video.count({ where: { status: 'REJECTED', deletedAt: null } }),
    ]);

    // ── Build where clause ────────────────────────────────────────────────────
    const where: Record<string, any> = { deletedAt: null };
    if (status && ['PENDING', 'APPROVED', 'REJECTED'].includes(status)) where.status = status;
    // "cat:<name>" filters on the main category (e.g. School Activity, whose
    // "Other" sub would otherwise match Talent's); a bare value is a sub-category.
    if (category?.startsWith('cat:')) where.category = { equals: category.slice(4), mode: 'insensitive' };
    else if (category) where.subCategory = { equals: category, mode: 'insensitive' };
    if (uploaderT && ['STUDENT', 'VIEWER'].includes(uploaderT)) where.uploaderType = uploaderT;

    const videos = await prisma.video.findMany({
      where,
      include: {
        student: {
          select: {
            name: true,
            olympiadCode: true,
            allocation: {
              include: {
                school: {
                  select: { name: true, city: true, district: true, state: true, olympiadId: true },
                },
              },
            },
          },
        },
        // Lets the Approved tab disable "Reject" on videos a jury evaluator has
        // already scored (the POST below refuses those anyway).
        _count: { select: { evaluations: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // ── Resolve appUser info ──────────────────────────────────────────────────
    const appUserIds = [...new Set(
      videos.filter(v => v.appUserId).map(v => v.appUserId as string)
    )];
    const appUsers = appUserIds.length > 0
      ? await prisma.appUser.findMany({
          where: { id: { in: appUserIds } },
          select: { id: true, userId: true, email: true, mobile: true, olympiadId: true },
        })
      : [];

    // Resolve school + assigned name for appUsers via their olympiadId → OlympiadIdAllocation
    const olympiadCodes = appUsers.map(u => u.olympiadId).filter(Boolean) as string[];
    const allocations = olympiadCodes.length > 0
      ? await prisma.olympiadIdAllocation.findMany({
          where: { code: { in: olympiadCodes } },
          select: {
            code: true,
            assignedName: true,
            school: { select: { name: true, city: true, district: true, state: true, olympiadId: true } },
          },
        })
      : [];
    const allocationMap = Object.fromEntries(allocations.map(a => [a.code, a]));

    const appUserMap = Object.fromEntries(appUsers.map(u => {
      const allocation = u.olympiadId ? allocationMap[u.olympiadId] : null;
      return [u.id, {
        ...u,
        assignedName: allocation?.assignedName ?? null,
        school: allocation?.school ?? null,
      }];
    }));

    // ── Normalise URLs ────────────────────────────────────────────────────────
    // schoolTags: the default tags the moderation page shows locked (see
    // schoolTagsForVideo, which the tag save uses).
    let normalized = (videos ?? []).map(v => {
      const appUser = v.appUserId ? (appUserMap[v.appUserId] ?? null) : null;
      const school = v.student?.allocation?.school ?? (v.studentId ? null : appUser?.school) ?? null;
      return {
        ...v,
        videoUrl:     v.videoUrl,
        thumbnailUrl: v.thumbnailUrl,
        appUser,
        schoolTags: schoolAutoTags(school),
      };
    });

    // ── Client-side search filter (name / olympiadCode / caption) ─────────────
    if (search) {
      const q = search.toLowerCase();
      normalized = normalized.filter(v =>
        v.caption?.toLowerCase().includes(q) ||
        v.student?.name?.toLowerCase().includes(q) ||
        v.student?.olympiadCode?.toLowerCase().includes(q) ||
        v.student?.allocation?.school?.name?.toLowerCase().includes(q) ||
        v.appUser?.userId?.toLowerCase().includes(q) ||
        (v.appUser as any)?.school?.name?.toLowerCase().includes(q) ||
        v.subCategory?.toLowerCase().includes(q) ||
        v.category?.toLowerCase().includes(q) ||
        v.tags?.toLowerCase().includes(q)
      );
    }

    return NextResponse.json({
      videos: normalized,
      counts: { PENDING: pendingCount, APPROVED: approvedCount, REJECTED: rejectedCount },
    });
  } catch (error: any) {
    console.error('Fetch videos error:', error);
    return NextResponse.json({ videos: [], counts: { PENDING: 0, APPROVED: 0, REJECTED: 0 } }, { status: 200 });
  }
}

export async function DELETE(request: Request) {
  const { error, payload } = await requireAdmin(request, 'moderation.pending');
  if (error) return error;

  try {
    const { videoIds } = await request.json();

    if (!Array.isArray(videoIds) || videoIds.length === 0) {
      return NextResponse.json({ message: 'No video IDs provided' }, { status: 400 });
    }

    const existing = await prisma.video.findMany({
      where: { id: { in: videoIds } },
      select: {
        id: true, status: true, olympiadVisibility: true,
        appUserId: true, caption: true, category: true, subCategory: true,
      },
    });

    const { count } = await prisma.video.deleteMany({
      where: { id: { in: videoIds } },
    });

    await Promise.all(existing.map(v => recordAuditLog({
      actorId: payload!.id,
      actorRole: payload!.role,
      actorName: payload!.name || payload!.email || null,
      action: 'VIDEO_DELETED',
      entityType: 'Video',
      entityId: v.id,
      previousValue: v,
      newValue: null,
    })));

    // Notify each video's owner, same as the reported-video removal flow —
    // moderation deletes previously left the user with no explanation at all.
    const notifyTargets = existing.filter(
      (v): v is typeof v & { appUserId: string } => Boolean(v.appUserId)
    );
    await Promise.all(notifyTargets.map(v => {
      const label = v.caption?.trim() || v.subCategory || v.category || 'your video';
      return prisma.notification.create({
        data: {
          userId:  v.appUserId,
          type:    'VIDEO_REMOVED',
          title:   'Video Removed',
          message: `Your video "${label}" was removed by an admin during content moderation.`,
        },
      });
    }));

    return NextResponse.json({ message: `${count} video(s) deleted successfully`, count });
  } catch (error) {
    console.error('Delete videos error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

// Older records store the raw 'Cat A' / 'Cat B' values rather than the current
// display labels, so both forms have to be recognised here — same as
// school/me/student-slots and school/me/reports already do.
function resolveSlot(category: string | null | undefined, subCategory: string | null | undefined) {
  if (category === OLYMPIAD_CAT_A_LABEL || category === 'Cat A' || OLYMPIAD_CAT_A_SUBS.includes(subCategory ?? '')) return 'A';
  if (category === OLYMPIAD_CAT_B_LABEL || category === 'Cat B' || OLYMPIAD_CAT_B_SUBS.includes(subCategory ?? '')) return 'B';
  return null;
}

/**
 * Whether another of the student's jury videos already occupies this A/B slot
 * — evaluated, or live and not rejected. Same rule as the student's upload.
 */
async function slotTakenBySibling(appUserId: string, videoId: string, slot: 'A' | 'B') {
  const siblings = await prisma.video.findMany({
    where: { appUserId, isEvaluation: true, id: { not: videoId } },
    select: { category: true, subCategory: true, status: true, deletedAt: true, evaluations: { select: { id: true } } },
  });
  return siblings.some(v =>
    resolveSlot(v.category, v.subCategory) === slot &&
    (v.evaluations.length > 0 || (v.deletedAt === null && v.status !== 'REJECTED'))
  );
}

/**
 * Admin (SuperAdmin / MasterAdmin) override: send an approved or rejected video back to the Pending
 * queue so it can be decided afresh. Quality and rejection reason are cleared
 * since both belong to the decision being undone. Single video only.
 */
async function moveToPending(payload: { id: string; role: string; name?: string; email?: string }, videoId: unknown, expected: string) {
  if (payload.role !== 'SUPERADMIN' && payload.role !== 'MASTER_ADMIN') {
    return NextResponse.json({ message: 'Only an admin can move a video back to Pending.' }, { status: 403 });
  }
  if (typeof videoId !== 'string' || !videoId) {
    return NextResponse.json({ message: 'videoId required' }, { status: 400 });
  }
  if (expected !== 'APPROVED' && expected !== 'REJECTED') {
    return NextResponse.json({ message: 'Only approved or rejected videos can be moved back to Pending.' }, { status: 400 });
  }

  const before = await prisma.video.findUnique({
    where: { id: videoId },
    select: {
      status: true, rejectionReason: true, quality: true, isEvaluation: true, appUserId: true,
      category: true, subCategory: true, deletedAt: true,
      _count: { select: { evaluations: true } },
    },
  });
  if (!before || before.deletedAt) return NextResponse.json({ message: 'This video no longer exists.' }, { status: 404 });
  if (before.status !== expected) return moderationConflict(videoId, payload.id);
  if (before._count.evaluations > 0) {
    return NextResponse.json(
      { message: 'This video has already been evaluated by the jury, so it can no longer be moved back to Pending.' },
      { status: 409 },
    );
  }

  // A rejected jury video frees its A/B slot, so the student may have uploaded
  // a replacement since. Reviving the old one would put two videos in a slot.
  if (expected === 'REJECTED' && before.isEvaluation && before.appUserId) {
    const slot = resolveSlot(before.category, before.subCategory);
    if (slot && await slotTakenBySibling(before.appUserId, videoId, slot)) {
      return NextResponse.json(
        { message: 'This student has since uploaded another video in the same category slot, so this one cannot be moved back to Pending.' },
        { status: 409 },
      );
    }
  }

  const written = await prisma.video.updateMany({
    where: { id: videoId, status: expected, deletedAt: null, ...NOT_EVALUATED },
    data: { status: 'PENDING', quality: null, rejectionReason: null, ...CLEAR_CLAIM },
  });
  if (written.count === 0) return moderationConflict(videoId, payload.id);

  await recordAuditLog({
    actorId: payload.id,
    actorRole: payload.role,
    actorName: payload.name || payload.email || null,
    action: 'VIDEO_MOVED_TO_PENDING',
    entityType: 'Video',
    entityId: videoId,
    previousValue: { status: before.status, quality: before.quality, rejectionReason: before.rejectionReason },
    newValue: { status: 'PENDING', quality: null, rejectionReason: null },
    reason: null,
  });

  return NextResponse.json({ message: 'Video moved back to Pending' });
}

export async function POST(request: Request) {
  const { error, payload } = requireRole(request, ['SUPERADMIN', 'MASTER_ADMIN', 'MODERATOR']);
  if (error) return error;

  const moduleCheck = await requireModule(payload, 'moderation.pending', request);
  if (moduleCheck.error) return moduleCheck.error;

  try {
    const { videoId, videoIds, status, rejectionReason, subCategory: newSubCategory, category: newCategory, quality, expectedStatus } = await request.json();

    // The status the moderator saw when they made the call. The write only
    // lands if the video is still in that state — otherwise someone else
    // decided it in the meantime and this would silently overwrite them.
    // Re-saving an approved video's category sends 'APPROVED' here.
    const expected: string = STATUSES.includes(expectedStatus) ? expectedStatus : 'PENDING';
    const now = new Date();

    if (status === 'PENDING') return moveToPending(payload!, videoId, expected);

    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return NextResponse.json({ message: 'Invalid status' }, { status: 400 });
    }
    // A moderator's call on source-footage quality is mandatory for approval,
    // and necessarily per-video — enforced here, not just by the dashboard
    // hiding its bulk-approve button, so this can't be bypassed by calling
    // the API directly.
    if (status === 'APPROVED' && !['HIGH', 'MEDIUM', 'LOW'].includes(quality)) {
      return NextResponse.json({ message: 'A video quality (High/Medium/Low) is required to approve.' }, { status: 400 });
    }
    if (status === 'APPROVED' && Array.isArray(videoIds) && videoIds.length > 0) {
      return NextResponse.json({ message: 'Bulk approve is not supported — quality must be set per video.' }, { status: 400 });
    }

    // Pulling back an already-approved video (Approved → Rejected) is a
    // admin-only (SuperAdmin / MasterAdmin) override; moderators can only decide pending videos.
    if (expected === 'APPROVED' && status === 'REJECTED' && payload!.role !== 'SUPERADMIN' && payload!.role !== 'MASTER_ADMIN') {
      return NextResponse.json({ message: 'Only an admin can reject an already-approved video.' }, { status: 403 });
    }

    const actor = {
      actorId: payload!.id,
      actorRole: payload!.role,
      actorName: payload!.name || payload!.email || null,
    };
    const action = status === 'APPROVED' ? 'VIDEO_APPROVED' : 'VIDEO_REJECTED';

    // ── Bulk action: videoIds array ─────────────────────────────────────────
    // REJECTED only at this point — APPROVED bulk was rejected above.
    if (Array.isArray(videoIds) && videoIds.length > 0) {
      // Only the selected videos still in the expected state and not under
      // someone else's live review are touched; the rest are reported back as
      // skipped rather than overwritten.
      const existing = await prisma.video.findMany({
        where: { id: { in: videoIds }, status: expected, ...claimFreeFor(payload!.id, now), ...(expected === 'APPROVED' ? NOT_EVALUATED : {}) },
        select: {
          id: true, status: true, rejectionReason: true,
          appUserId: true, uploadedBySchoolId: true, caption: true, category: true, subCategory: true,
        },
      });

      await prisma.video.updateMany({
        where: { id: { in: existing.map(v => v.id) }, status: expected, ...(expected === 'APPROVED' ? NOT_EVALUATED : {}) },
        data: {
          status,
          rejectionReason: status === 'REJECTED' ? (rejectionReason || null) : null,
          ...CLEAR_CLAIM,
        },
      });

      await Promise.all(existing.map(v => recordAuditLog({
        ...actor,
        action,
        entityType: 'Video',
        entityId: v.id,
        previousValue: { status: v.status, rejectionReason: v.rejectionReason },
        newValue: { status, rejectionReason: status === 'REJECTED' ? (rejectionReason || null) : null },
        reason: status === 'REJECTED' ? (rejectionReason || null) : null,
      })));

      await Promise.all(existing.map(v => notifyVideoStatus(v, status, rejectionReason)));

      const skipped = videoIds.length - existing.length;
      return NextResponse.json({
        message: `${existing.length} video(s) ${status.toLowerCase()}`
          + (skipped ? ` · ${skipped} skipped (already decided, already evaluated, or being reviewed by another moderator)` : ''),
        updated: existing.map(v => v.id),
        skipped,
      });
    }

    // ── Single action: videoId ────────────────────────────────────────────────
    if (!videoId) return NextResponse.json({ message: 'videoId required' }, { status: 400 });

    const before = await prisma.video.findUnique({
      where: { id: videoId },
      select: {
        status: true, rejectionReason: true, quality: true, isEvaluation: true, uploaderType: true, appUserId: true, uploadedBySchoolId: true,
        caption: true, category: true, subCategory: true, isPublic: true, olympiadVisibility: true, tags: true,
        _count: { select: { evaluations: true } },
      },
    });
    if (!before) return NextResponse.json({ message: 'Video not found' }, { status: 404 });
    // Fail fast before the slot checks below; the atomic write further down
    // re-checks, which closes the gap between this read and that write.
    if (before.status !== expected) return moderationConflict(videoId, payload!.id);

    // Un-approving: an approved jury video may already carry an evaluator's
    // score, and rejecting it would silently drop that score from results.
    // Only videos nobody has evaluated yet can be pulled back.
    const unapproving = expected === 'APPROVED' && status === 'REJECTED';
    if (unapproving && before._count.evaluations > 0) return evaluatedConflict();

    // Moderator is recategorizing an olympiad (jury) video before approving — re-run
    // the same 1-per-category slot check the student's upload does, so approving into
    // a corrected category can't create a second video occupying that same A/B slot.
    const subCategoryChanged = typeof newSubCategory === 'string' && newSubCategory !== before?.subCategory;
    const categoryChanged    = typeof newCategory === 'string' && newCategory !== before?.category;

    if (status === 'APPROVED' && before?.isEvaluation && (subCategoryChanged || categoryChanged)) {
      // An explicit main category from the moderator is authoritative; only fall
      // back to the video's existing one when they didn't change it.
      const targetSlot = resolveSlot(
        categoryChanged ? newCategory : before.category,
        subCategoryChanged ? newSubCategory : before.subCategory,
      );
      if (targetSlot && before.appUserId) {
        if (await slotTakenBySibling(before.appUserId, videoId, targetSlot)) {
          return NextResponse.json(
            { message: 'This student already has a video in that category slot. Reject this one instead.' },
            { status: 409 },
          );
        }
      }
    }

    const recategorizing = status === 'APPROVED' && (subCategoryChanged || categoryChanged);

    // A non-Olympiad video may only move within the categories its uploader
    // gets in the app (a school's own video can't become Parenting, a general
    // user's can't become School Activity). Jury videos keep the A/B rules above.
    if (recategorizing && !before.isEvaluation) {
      const targetCategory = categoryChanged ? newCategory : currentGroupLabel(before);
      const targetSub      = subCategoryChanged ? newSubCategory : before.subCategory;
      if (!isAllowedCategory(before, targetCategory, targetSub ?? '')) {
        return NextResponse.json(
          { message: `"${targetSub}" under "${targetCategory}" is not a category this uploader can use.` },
          { status: 400 },
        );
      }
    }

    // Derive the main category from the new subcategory only as a fallback. A
    // custom subcategory ("Any Other Special Talent", a typed-in rhyme name) is
    // in neither subs list, so resolveSlot returns null for it — previously that
    // silently kept the old main category while the subcategory changed.
    const derivedSlot = recategorizing
      ? resolveSlot(categoryChanged ? newCategory : null, subCategoryChanged ? newSubCategory : before?.subCategory)
      : null;
    const derivedCategory =
      derivedSlot === 'A' ? OLYMPIAD_CAT_A_LABEL :
      derivedSlot === 'B' ? OLYMPIAD_CAT_B_LABEL : null;

    // Conditional write: lands only if the video is still in the state the
    // moderator saw and nobody else holds a live review claim on it. Two
    // moderators saving at the same instant can't both succeed.
    const written = await prisma.video.updateMany({
      where: { id: videoId, status: expected, ...claimFreeFor(payload!.id, now), ...(unapproving ? NOT_EVALUATED : {}) },
      data: {
        status,
        rejectionReason: status === 'REJECTED' ? (rejectionReason || null) : null,
        quality: status === 'APPROVED' ? quality : null,
        ...(recategorizing
          ? {
              ...(subCategoryChanged ? { subCategory: newSubCategory } : {}),
              category: categoryChanged ? newCategory : (derivedCategory ?? before?.category),
            }
          : {}),
        ...CLEAR_CLAIM,
      },
    });
    if (written.count === 0) {
      // An evaluator may have scored it between the read above and this write.
      if (unapproving && await prisma.videoEvaluation.count({ where: { videoId } }) > 0) return evaluatedConflict();
      return moderationConflict(videoId, payload!.id);
    }

    let video = await prisma.video.findUniqueOrThrow({ where: { id: videoId } });

    // A new main category brings its own default tag (e.g. #TalentPerformance
    // → #RhymesSpeech).
    if (recategorizing && video.isEvaluation) {
      const tags = await tagsWithDefaults(video, splitTags(video.tags));
      if (tags !== (video.tags || '')) {
        video = await prisma.video.update({ where: { id: videoId }, data: { tags: tags || null } });
      }
    }

    await recordAuditLog({
      ...actor,
      action,
      entityType: 'Video',
      entityId: videoId,
      previousValue: (({ _count, ...rest }) => rest)(before),
      newValue: { status: video.status, rejectionReason: video.rejectionReason, quality: video.quality, category: video.category, subCategory: video.subCategory },
      reason: status === 'REJECTED' ? (rejectionReason || null) : null,
    });

    // A recategorization rides along with an approve, so it would otherwise be
    // buried under a VIDEO_APPROVED row. Log it separately as well, so the
    // activity log can answer "who moved this video's category" on its own.
    if (recategorizing && (video.category !== before?.category || video.subCategory !== before?.subCategory)) {
      await recordAuditLog({
        ...actor,
        action: 'VIDEO_RECATEGORIZED',
        entityType: 'Video',
        entityId: videoId,
        previousValue: { category: before?.category ?? null, subCategory: before?.subCategory ?? null, tags: before?.tags ?? null },
        newValue: { category: video.category, subCategory: video.subCategory, tags: video.tags },
        reason: null,
      });
    }

    await notifyVideoStatus({ id: videoId, ...before }, status, rejectionReason);

    // Followers hear about it only the first time it goes live (not when an
    // approved video is merely re-saved with a new category), and only if they
    // can actually see it: not a private/hidden video or a private Olympiad one.
    const visibleToFollowers = before.isPublic && !(before.isEvaluation && before.olympiadVisibility !== 'public');
    if (status === 'APPROVED' && before.status !== 'APPROVED' && before.appUserId && visibleToFollowers) {
      const uploader = await prisma.appUser.findUnique({ where: { id: before.appUserId }, select: { userId: true } });
      await notifyFollowersOfNewVideo({
        uploaderId: before.appUserId,
        videoId,
        uploaderUserId: uploader?.userId ?? 'Someone',
      });
    }

    return NextResponse.json({ message: `Video ${status.toLowerCase()} successfully`, video });
  } catch (error) {
    console.error('Update video status error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

// Tags or caption edit — independent of status/approve-reject, so a moderator
// can fix hashtags or the caption on a video regardless of which tab (Pending/
// Approved/Rejected) it's currently sitting in, without that edit accidentally
// changing its moderation status. Send `tags` or `caption` (one per request).


export async function PATCH(request: Request) {
  const { error, payload } = requireRole(request, ['SUPERADMIN', 'MASTER_ADMIN', 'MODERATOR']);
  if (error) return error;

  const moduleCheck = await requireModule(payload, 'moderation.pending', request);
  if (moduleCheck.error) return moduleCheck.error;

  try {
    const { videoId, tags, caption, visibility, reason } = await request.json();
    if (!videoId) return NextResponse.json({ message: 'videoId required' }, { status: 400 });

    // Visibility override — SUPERADMIN ONLY (not Master Admin, not Moderator).
    // Flips a video between public and private whatever its status, using the
    // same field the moderation page's Public/Private badge reads: an Olympiad
    // video's own olympiadVisibility, any other video's isPublic.
    if (visibility !== undefined) {
      if (payload!.role !== 'SUPERADMIN') {
        return NextResponse.json({ message: "Only a Super Admin can change a video's visibility." }, { status: 403 });
      }
      if (visibility !== 'public' && visibility !== 'private') {
        return NextResponse.json({ message: 'visibility must be "public" or "private"' }, { status: 400 });
      }
      const note = typeof reason === 'string' ? reason.trim().replace(/\s+/g, ' ').slice(0, 500) || null : null;

      const current = await prisma.video.findUnique({
        where: { id: videoId },
        select: { id: true, isEvaluation: true, isPublic: true, olympiadVisibility: true, deletedAt: true },
      });
      if (!current) return NextResponse.json({ message: 'Video not found' }, { status: 404 });
      if (current.deletedAt) return NextResponse.json({ message: 'This video has been deleted.' }, { status: 409 });

      const wasPublic = current.isEvaluation ? current.olympiadVisibility === 'public' : current.isPublic;
      if (wasPublic === (visibility === 'public')) {
        return NextResponse.json({ message: `Already ${visibility}`, video: { id: current.id, isPublic: current.isPublic, olympiadVisibility: current.olympiadVisibility } });
      }

      const video = await prisma.video.update({
        where: { id: videoId },
        data: current.isEvaluation ? { olympiadVisibility: visibility } : { isPublic: visibility === 'public' },
        select: { id: true, isPublic: true, olympiadVisibility: true },
      });

      await recordAuditLog({
        actorId: payload!.id,
        actorRole: payload!.role,
        actorName: payload!.name || payload!.email || null,
        action: 'VISIBILITY_CHANGED',
        entityType: 'Video',
        entityId: videoId,
        previousValue: { visibility: wasPublic ? 'public' : 'private', field: current.isEvaluation ? 'olympiadVisibility' : 'isPublic' },
        newValue: { visibility },
        reason: note,
      });

      return NextResponse.json({ message: `Video is now ${visibility}`, video });
    }

    if (caption !== undefined) {
      if (typeof caption !== 'string') return NextResponse.json({ message: 'caption must be a string' }, { status: 400 });
      const trimmed = caption.trim();
      if (trimmed.length > MAX_CAPTION_LENGTH) {
        return NextResponse.json({ message: `Caption can be at most ${MAX_CAPTION_LENGTH} characters.` }, { status: 400 });
      }
      // Same abuse check the app runs on a caption.
      const captionAbuse = captionTagsAbuseMessage(trimmed, undefined);
      if (captionAbuse) return NextResponse.json({ message: captionAbuse }, { status: 422 });

      const before = await prisma.video.findUnique({ where: { id: videoId }, select: { caption: true } });
      if (!before) return NextResponse.json({ message: 'Video not found' }, { status: 404 });

      const video = await prisma.video.update({
        where: { id: videoId },
        data: { caption: trimmed || null },
        select: { id: true, caption: true },
      });

      await recordAuditLog({
        actorId: payload!.id,
        actorRole: payload!.role,
        actorName: payload!.name || payload!.email || null,
        action: 'VIDEO_CAPTION_UPDATED',
        entityType: 'Video',
        entityId: videoId,
        previousValue: { caption: before.caption },
        newValue: { caption: video.caption },
        reason: null,
      });

      return NextResponse.json({ message: 'Caption updated', video });
    }

    if (typeof tags !== 'string') return NextResponse.json({ message: 'tags must be a string' }, { status: 400 });

    // Normalize: dedupe, strip empties/# prefixes and surrounding whitespace,
    // same comma-separated shape the rest of the app already stores in tags.
    // Cleaned the way the app cleans a hashtag (no #, spaces or commas).
    const normalizedTags = [...new Set(
      tags.split(',').map(cleanHashtag).filter(Boolean)
    )].join(',');

    const before = await prisma.video.findUnique({
      where: { id: videoId },
      select: { tags: true, isMittfest: true, studentId: true, appUserId: true, isEvaluation: true, category: true, subCategory: true },
    });
    if (!before) return NextResponse.json({ message: 'Video not found' }, { status: 404 });

    // Default tags are put back by tagsWithDefaults below, so they never count
    // as something a moderator added.
    const finalTags = await tagsWithDefaults(before, splitTags(normalizedTags));
    const defaults = new Set(
      videoDefaultTags(await schoolTagsForVideo(before), before).map(t => t.toLowerCase())
    );

    // Same limits as the app: at most 30 hashtags besides the default ones, and
    // a newly added one must pass the abuse check.
    const previous = new Set(splitTags(before.tags).map(t => t.toLowerCase()));
    const ownTags = splitTags(finalTags).filter(t => !defaults.has(t.toLowerCase()));
    if (ownTags.length > MAX_CUSTOM_TAGS && ownTags.length > [...previous].filter(t => !defaults.has(t)).length) {
      return NextResponse.json({ message: `Max ${MAX_CUSTOM_TAGS} hashtags.` }, { status: 400 });
    }
    const newTags = ownTags.filter(t => !previous.has(t.toLowerCase()));
    const abuse = newTags.length ? captionTagsAbuseMessage(undefined, newTags.join(',')) : null;
    if (abuse) return NextResponse.json({ message: abuse }, { status: 422 });

    // Moderators may only remove hashtags; adding (or renaming, which is an
    // add) is for admins. #mittfest counts as existing on a MittFest video
    // because the moderation page shows it as a chip even when it isn't stored.
    if (payload!.role === 'MODERATOR') {
      const existing = new Set(
        (before.tags || '').split(',').map(t => t.trim().replace(/^#/, '').toLowerCase()).filter(Boolean)
      );
      if (before.isMittfest) existing.add('mittfest');
      const added = splitTags(finalTags).filter(t => !existing.has(t.toLowerCase()) && !defaults.has(t.toLowerCase()));
      if (added.length > 0) {
        return NextResponse.json(
          { message: `Moderators can remove hashtags but not add them: ${added.map(t => `#${t}`).join(', ')}` },
          { status: 403 }
        );
      }
    }

    const video = await prisma.video.update({
      where: { id: videoId },
      data: { tags: finalTags || null },
      select: { id: true, tags: true },
    });

    await recordAuditLog({
      actorId: payload!.id,
      actorRole: payload!.role,
      actorName: payload!.name || payload!.email || null,
      action: 'VIDEO_TAGS_UPDATED',
      entityType: 'Video',
      entityId: videoId,
      previousValue: { tags: before.tags },
      newValue: { tags: video.tags },
      reason: null,
    });

    return NextResponse.json({ message: 'Tags updated', video });
  } catch (error) {
    console.error('Update video tags error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
