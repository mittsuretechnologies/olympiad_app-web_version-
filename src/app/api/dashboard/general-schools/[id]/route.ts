import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth-guard';
import { recordAuditLog } from '@/lib/audit-log';
import { createNotification } from '@/lib/notifications';
import { GENERAL_SCHOOL_AGREEMENT_ROLE } from '@/lib/generalSchool';

export const dynamic = 'force-dynamic';

// GET   /api/dashboard/general-schools/:id - full record, agreement history,
//                                            and the school's recent videos
// PATCH /api/dashboard/general-schools/:id - { isActive: boolean, reason? }
//       Switching a school off blocks its login (403), logs out any open
//       session on the next app foreground (/app/me answers 401), and hides
//       its videos from every feed and search (see lib/videoVisibility.ts).

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = requireRole(request, ['SUPERADMIN']);
  if (error) return error;

  try {
    const { id } = await params;
    const school = await prisma.generalSchool.findUnique({
      where: { id },
      include: {
        appUser: {
          select: {
            id: true, userId: true, isPrivate: true, avatarUrl: true, lastLoginAt: true,
            deletionRequestedAt: true, createdAt: true,
          },
        },
      },
    });
    if (!school) return NextResponse.json({ message: 'School not found' }, { status: 404 });

    const [agreements, videos, followers, following] = await Promise.all([
      prisma.agreementAcceptance.findMany({
        where: { role: GENERAL_SCHOOL_AGREEMENT_ROLE, actorId: school.id },
        orderBy: { acceptedAt: 'desc' },
        select: {
          id: true, documentVersion: true, acceptedAt: true, ipAddress: true, userAgent: true,
          verificationChannel: true, verificationTarget: true, signatoryName: true,
          signatoryDesignation: true, readCompletedAt: true, revokedAt: true, revokeReason: true,
        },
      }),
      prisma.video.findMany({
        where: { appUserId: school.appUserId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true, thumbnailUrl: true, videoUrl: true, caption: true, category: true,
          subCategory: true, status: true, likesCount: true, viewsCount: true, createdAt: true,
        },
      }),
      prisma.follow.count({ where: { followingId: school.appUserId } }),
      prisma.follow.count({ where: { followerId: school.appUserId } }),
    ]);

    return NextResponse.json({ school, agreements, videos, followers, following });
  } catch (err) {
    console.error('GET dashboard/general-schools/[id] failed:', err);
    return NextResponse.json({ message: 'Failed to load school' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { payload, error } = requireRole(request, ['SUPERADMIN']);
  if (error) return error;

  try {
    const { id } = await params;
    const body = await request.json().catch(() => null);
    if (!body || typeof body.isActive !== 'boolean') {
      return NextResponse.json({ message: 'isActive (true/false) is required' }, { status: 400 });
    }
    const reason = typeof body.reason === 'string' ? body.reason.trim().replace(/\s+/g, ' ').slice(0, 500) || null : null;

    const school = await prisma.generalSchool.findUnique({
      where: { id },
      select: { id: true, name: true, isActive: true, appUserId: true },
    });
    if (!school) return NextResponse.json({ message: 'School not found' }, { status: 404 });
    if (school.isActive === body.isActive) {
      return NextResponse.json({ id: school.id, isActive: school.isActive });
    }

    await prisma.generalSchool.update({ where: { id }, data: { isActive: body.isActive } });

    await recordAuditLog({
      actorId: payload.id, actorRole: payload.role, actorName: payload.name || payload.email || null,
      action: body.isActive ? 'GENERAL_SCHOOL_ACTIVATED' : 'GENERAL_SCHOOL_DEACTIVATED',
      entityType: 'GeneralSchool', entityId: school.id,
      previousValue: { isActive: school.isActive }, newValue: { isActive: body.isActive, name: school.name },
      reason,
    });

    // Tell a re-enabled school it can use the app again. (A deactivated school
    // is logged out and cannot read notifications, so none is sent then.)
    if (body.isActive) {
      await createNotification({
        userId: school.appUserId,
        type: 'GENERAL_SCHOOL_ACTIVATED',
        title: 'School account reactivated',
        message: `${school.name} can use Mittmee again.`,
      });
    }

    return NextResponse.json({ id: school.id, isActive: body.isActive });
  } catch (err) {
    console.error('PATCH dashboard/general-schools/[id] failed:', err);
    return NextResponse.json({ message: 'Failed to update school' }, { status: 500 });
  }
}
