import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole, requireModule } from '@/lib/auth-guard';
import { recordAuditLog } from '@/lib/audit-log';
import { createNotification } from '@/lib/notifications';
import { OLYMPIAD_CAT_A_LABEL, OLYMPIAD_CAT_B_LABEL, OLYMPIAD_CAT_A_SUBS, OLYMPIAD_CAT_B_SUBS } from '@/lib/olympiad-categories';

export const dynamic = 'force-dynamic';

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
    const [pendingCount, approvedCount, rejectedCount] = await Promise.all([
      prisma.video.count({ where: { status: 'PENDING' } }),
      prisma.video.count({ where: { status: 'APPROVED' } }),
      prisma.video.count({ where: { status: 'REJECTED' } }),
    ]);

    // ── Build where clause ────────────────────────────────────────────────────
    const where: Record<string, any> = {};
    if (status && ['PENDING', 'APPROVED', 'REJECTED'].includes(status)) where.status = status;
    if (category) where.subCategory = category;
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
                  select: { name: true, city: true, district: true, state: true },
                },
              },
            },
          },
        },
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
            school: { select: { name: true, city: true, district: true, state: true } },
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
    let normalized = (videos ?? []).map(v => ({
      ...v,
      videoUrl:     v.videoUrl,
      thumbnailUrl: v.thumbnailUrl,
      appUser: v.appUserId ? (appUserMap[v.appUserId] ?? null) : null,
    }));

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
        v.category?.toLowerCase().includes(q)
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
  const { error, payload } = requireRole(request, ['SUPERADMIN']);
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
      actorName: payload!.email || payload!.name || null,
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

function resolveSlot(category: string | null | undefined, subCategory: string | null | undefined) {
  if (category === OLYMPIAD_CAT_A_LABEL || OLYMPIAD_CAT_A_SUBS.includes(subCategory ?? '')) return 'A';
  if (category === OLYMPIAD_CAT_B_LABEL || OLYMPIAD_CAT_B_SUBS.includes(subCategory ?? '')) return 'B';
  return null;
}

export async function POST(request: Request) {
  const { error, payload } = requireRole(request, ['SUPERADMIN', 'MODERATOR']);
  if (error) return error;

  const moduleCheck = await requireModule(payload, 'moderation.pending');
  if (moduleCheck.error) return moduleCheck.error;

  try {
    const { videoId, videoIds, status, rejectionReason, subCategory: newSubCategory } = await request.json();

    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return NextResponse.json({ message: 'Invalid status' }, { status: 400 });
    }

    const actor = {
      actorId: payload!.id,
      actorRole: payload!.role,
      actorName: payload!.email || payload!.name || null,
    };
    const action = status === 'APPROVED' ? 'VIDEO_APPROVED' : 'VIDEO_REJECTED';

    // ── Bulk action: videoIds array ───────────────────────────────────────────
    if (Array.isArray(videoIds) && videoIds.length > 0) {
      const existing = await prisma.video.findMany({
        where: { id: { in: videoIds } },
        select: {
          id: true, status: true, rejectionReason: true,
          appUserId: true, caption: true, category: true, subCategory: true,
        },
      });

      await prisma.video.updateMany({
        where: { id: { in: videoIds } },
        data: {
          status,
          rejectionReason: status === 'REJECTED' ? (rejectionReason || null) : null,
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

      await Promise.all(existing.map(v => v.appUserId
        ? createNotification(buildVideoStatusNotification(v, status, rejectionReason))
        : Promise.resolve()));

      return NextResponse.json({ message: `${videoIds.length} video(s) ${status.toLowerCase()}` });
    }

    // ── Single action: videoId ────────────────────────────────────────────────
    if (!videoId) return NextResponse.json({ message: 'videoId required' }, { status: 400 });

    const before = await prisma.video.findUnique({
      where: { id: videoId },
      select: {
        status: true, rejectionReason: true, isEvaluation: true, appUserId: true,
        caption: true, category: true, subCategory: true,
      },
    });

    // Moderator is recategorizing an olympiad (jury) video before approving — re-run
    // the same 1-per-category slot check the student's upload does, so approving into
    // a corrected category can't create a second video occupying that same A/B slot.
    if (status === 'APPROVED' && before?.isEvaluation && typeof newSubCategory === 'string' && newSubCategory !== before.subCategory) {
      const targetSlot = resolveSlot(before.category, newSubCategory);
      if (targetSlot && before.appUserId) {
        const siblings = await prisma.video.findMany({
          where: { appUserId: before.appUserId, isEvaluation: true, id: { not: videoId } },
          select: { category: true, subCategory: true, status: true, deletedAt: true, evaluations: { select: { id: true } } },
        });
        const slotTaken = siblings.some(v =>
          resolveSlot(v.category, v.subCategory) === targetSlot &&
          (v.evaluations.length > 0 || (v.deletedAt === null && v.status !== 'REJECTED'))
        );
        if (slotTaken) {
          return NextResponse.json(
            { message: 'This student already has a video in that category slot. Reject this one instead.' },
            { status: 409 },
          );
        }
      }
    }

    const recategorizing = status === 'APPROVED' && typeof newSubCategory === 'string' && newSubCategory !== before?.subCategory;
    const newSlot = recategorizing ? resolveSlot(null, newSubCategory) : null;

    const video = await prisma.video.update({
      where: { id: videoId },
      data: {
        status,
        rejectionReason: status === 'REJECTED' ? (rejectionReason || null) : null,
        ...(recategorizing
          ? {
              subCategory: newSubCategory,
              category: newSlot === 'A' ? OLYMPIAD_CAT_A_LABEL : newSlot === 'B' ? OLYMPIAD_CAT_B_LABEL : before?.category,
            }
          : {}),
      },
    });

    await recordAuditLog({
      ...actor,
      action,
      entityType: 'Video',
      entityId: videoId,
      previousValue: before,
      newValue: { status: video.status, rejectionReason: video.rejectionReason, category: video.category, subCategory: video.subCategory },
      reason: status === 'REJECTED' ? (rejectionReason || null) : null,
    });

    if (before?.appUserId) {
      await createNotification(buildVideoStatusNotification(
        { id: videoId, ...before },
        status,
        rejectionReason,
      ));
    }

    return NextResponse.json({ message: `Video ${status.toLowerCase()} successfully`, video });
  } catch (error) {
    console.error('Update video status error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
