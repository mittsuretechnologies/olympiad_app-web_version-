import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth-guard';
import { SCHOOL_AGREEMENT_KEY, SCHOOL_AGREEMENT_VERSION } from '@/lib/agreements/school-onboarding';
import { GENERAL_SCHOOL_AGREEMENT_ROLE } from '@/lib/generalSchool';

export const dynamic = 'force-dynamic';

// GET /api/dashboard/general-schools - SuperAdmin-only register of schools that
// signed up in the mobile app (not the Olympiad `School` table).
// Query: q, status (all|active|inactive|agreement-pending), state, page,
//        pageSize, all=1 (no pagination - for CSV export)
export async function GET(request: Request) {
  const { error } = requireRole(request, ['SUPERADMIN']);
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') || '').trim();
    const status = searchParams.get('status') || 'all';
    const state = (searchParams.get('state') || '').trim();
    const all = searchParams.get('all') === '1';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '25', 10)));

    // Current (unrevoked) acceptances of the current version, newest per school.
    const acceptances = await prisma.agreementAcceptance.findMany({
      where: {
        role: GENERAL_SCHOOL_AGREEMENT_ROLE, documentKey: SCHOOL_AGREEMENT_KEY,
        documentVersion: SCHOOL_AGREEMENT_VERSION, revokedAt: null,
      },
      orderBy: { acceptedAt: 'desc' },
      select: { id: true, actorId: true, acceptedAt: true, ipAddress: true, verificationChannel: true },
    });
    const acceptanceBySchool = new Map<string, (typeof acceptances)[number]>();
    for (const a of acceptances) if (!acceptanceBySchool.has(a.actorId)) acceptanceBySchool.set(a.actorId, a);
    const acceptedIds = [...acceptanceBySchool.keys()];

    // Revoked ones (a SuperAdmin asked the school to accept again).
    const revoked = await prisma.agreementAcceptance.findMany({
      where: {
        role: GENERAL_SCHOOL_AGREEMENT_ROLE, documentKey: SCHOOL_AGREEMENT_KEY,
        documentVersion: SCHOOL_AGREEMENT_VERSION, revokedAt: { not: null },
      },
      orderBy: { revokedAt: 'desc' },
      select: { actorId: true, revokedAt: true, revokeReason: true },
    });
    const revokedBySchool = new Map<string, { requestedAt: Date; reason: string | null }>();
    for (const r of revoked) {
      if (!revokedBySchool.has(r.actorId)) revokedBySchool.set(r.actorId, { requestedAt: r.revokedAt!, reason: r.revokeReason });
    }

    const search: Prisma.GeneralSchoolWhereInput = q
      ? { OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
          { mobile: { contains: q } },
          { city: { contains: q, mode: 'insensitive' } },
          { district: { contains: q, mode: 'insensitive' } },
          { appUser: { userId: { contains: q, mode: 'insensitive' } } },
        ] }
      : {};
    const statusFilter: Prisma.GeneralSchoolWhereInput =
      status === 'active' ? { isActive: true }
      : status === 'inactive' ? { isActive: false }
      : status === 'agreement-pending' ? { id: { notIn: acceptedIds } }
      : {};
    const stateFilter: Prisma.GeneralSchoolWhereInput = state ? { state: { equals: state, mode: 'insensitive' } } : {};
    const where: Prisma.GeneralSchoolWhereInput = { AND: [search, statusFilter, stateFilter] };

    const [total, activeCount, inactiveCount, filteredTotal, schools, states] = await Promise.all([
      prisma.generalSchool.count(),
      prisma.generalSchool.count({ where: { isActive: true } }),
      prisma.generalSchool.count({ where: { isActive: false } }),
      prisma.generalSchool.count({ where }),
      prisma.generalSchool.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...(all ? {} : { skip: (page - 1) * pageSize, take: pageSize }),
        include: {
          appUser: { select: { id: true, userId: true, lastLoginAt: true, isPrivate: true, deletionRequestedAt: true } },
        },
      }),
      prisma.generalSchool.findMany({ distinct: ['state'], select: { state: true }, orderBy: { state: 'asc' } }),
    ]);

    const appUserIds = schools.map(s => s.appUserId);
    const [videoGroups, followerGroups] = appUserIds.length
      ? await Promise.all([
          prisma.video.groupBy({
            by: ['appUserId', 'status'],
            where: { appUserId: { in: appUserIds }, deletedAt: null },
            _count: { _all: true },
          }),
          prisma.follow.groupBy({
            by: ['followingId'],
            where: { followingId: { in: appUserIds } },
            _count: { _all: true },
          }),
        ])
      : [[], []];

    const videosByUser = new Map<string, { total: number; approved: number; pending: number; rejected: number }>();
    for (const g of videoGroups) {
      if (!g.appUserId) continue;
      const cur = videosByUser.get(g.appUserId) ?? { total: 0, approved: 0, pending: 0, rejected: 0 };
      cur.total += g._count._all;
      if (g.status === 'APPROVED') cur.approved += g._count._all;
      else if (g.status === 'PENDING') cur.pending += g._count._all;
      else if (g.status === 'REJECTED') cur.rejected += g._count._all;
      videosByUser.set(g.appUserId, cur);
    }
    const followersByUser = new Map(followerGroups.map(g => [g.followingId, g._count._all]));

    return NextResponse.json({
      stats: {
        total, active: activeCount, inactive: inactiveCount,
        agreementPending: Math.max(0, total - acceptedIds.length),
      },
      states: states.map(s => s.state),
      total: filteredTotal,
      page: all ? 1 : page,
      pageSize: all ? filteredTotal : pageSize,
      schools: schools.map(s => {
        const acc = acceptanceBySchool.get(s.id);
        const rev = revokedBySchool.get(s.id);
        return {
          id: s.id,
          appUserId: s.appUserId,
          username: s.appUser.userId,
          name: s.name,
          email: s.email,
          mobile: s.mobile,
          contactPerson: s.contactPerson,
          state: s.state,
          district: s.district,
          city: s.city,
          pincode: s.pincode,
          address: s.address,
          isActive: s.isActive,
          isPrivate: s.appUser.isPrivate,
          deletionRequestedAt: s.appUser.deletionRequestedAt,
          lastLoginAt: s.appUser.lastLoginAt,
          createdAt: s.createdAt,
          followers: followersByUser.get(s.appUserId) ?? 0,
          videos: videosByUser.get(s.appUserId) ?? { total: 0, approved: 0, pending: 0, rejected: 0 },
          agreement: acc
            ? { accepted: true, acceptanceId: acc.id, acceptedAt: acc.acceptedAt, ipAddress: acc.ipAddress, channel: acc.verificationChannel, version: SCHOOL_AGREEMENT_VERSION }
            : { accepted: false, acceptanceId: null, acceptedAt: null, ipAddress: null, channel: null, version: SCHOOL_AGREEMENT_VERSION, reacceptanceRequested: rev ?? null },
        };
      }),
    });
  } catch (err) {
    console.error('GET dashboard/general-schools failed:', err);
    return NextResponse.json({ message: 'Failed to load general schools' }, { status: 500 });
  }
}
