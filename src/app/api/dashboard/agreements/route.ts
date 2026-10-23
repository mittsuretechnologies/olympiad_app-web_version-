import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth-guard';
import { SCHOOL_AGREEMENT_KEY, SCHOOL_AGREEMENT_VERSION } from '@/lib/agreements/school-onboarding';
import { EVALUATOR_TERMS_KEY, EVALUATOR_TERMS_VERSION } from '@/lib/evaluatorTerms';

export const dynamic = 'force-dynamic';

// GET /api/dashboard/agreements — superadmin-only register of legal agreement
// acceptances, per role:
//   SCHOOL    — School Onboarding Agreement (AgreementAcceptance records)
//   MODERATOR — first-login Terms & Conditions (Moderator.termsAccepted/At)
//   EVALUATOR — Evaluator Terms & Privacy Policy (AgreementAcceptance records)
// Query: role (SCHOOL|MODERATOR|EVALUATOR), status (all|accepted|pending), q, page,
//        pageSize, all=1 (no pagination — for CSV export)

type ListParams = { status: string; q: string; all: boolean; page: number; pageSize: number };

export async function GET(request: Request) {
  const { error } = await requireAdmin(request, 'agreements');
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const role = (searchParams.get('role') || 'SCHOOL').toUpperCase();
    const params: ListParams = {
      status: searchParams.get('status') || 'all',
      q: (searchParams.get('q') || '').trim(),
      all: searchParams.get('all') === '1',
      page: Math.max(1, parseInt(searchParams.get('page') || '1', 10)),
      pageSize: Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '25', 10))),
    };
    if (role === 'MODERATOR') return NextResponse.json(await moderatorRegister(params));
    if (role === 'EVALUATOR') return NextResponse.json(await evaluatorRegister(params));
    if (role !== 'SCHOOL') {
      return NextResponse.json({ message: `No agreement is configured for ${role} yet.` }, { status: 400 });
    }
    const { status, q, all, page, pageSize } = params;

    // Every current (unrevoked) acceptance of the current version — at most one
    // per school — so the accepted/pending split can be a school-id filter.
    const acceptances = await prisma.agreementAcceptance.findMany({
      where: { role, documentKey: SCHOOL_AGREEMENT_KEY, documentVersion: SCHOOL_AGREEMENT_VERSION, revokedAt: null },
      orderBy: { acceptedAt: 'desc' },
    });
    const byActor = new Map<string, (typeof acceptances)[number]>();
    for (const a of acceptances) if (!byActor.has(a.actorId)) byActor.set(a.actorId, a);

    // Revoked acceptances: a SuperAdmin asked these schools to accept again.
    // Newest per school, shown on its pending row.
    const revoked = await prisma.agreementAcceptance.findMany({
      where: { role, documentKey: SCHOOL_AGREEMENT_KEY, documentVersion: SCHOOL_AGREEMENT_VERSION, revokedAt: { not: null } },
      orderBy: { revokedAt: 'desc' },
      select: { actorId: true, acceptedAt: true, revokedAt: true, revokeReason: true },
    });
    const reacceptByActor = new Map<string, { requestedAt: Date; reason: string | null; previousAcceptedAt: Date }>();
    for (const r of revoked) {
      if (!reacceptByActor.has(r.actorId)) {
        reacceptByActor.set(r.actorId, { requestedAt: r.revokedAt!, reason: r.revokeReason, previousAcceptedAt: r.acceptedAt });
      }
    }
    const acceptedIds = [...byActor.keys()];

    const search: Prisma.SchoolWhereInput = q
      ? { OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { schoolId: { contains: q, mode: 'insensitive' } },
          { city: { contains: q, mode: 'insensitive' } },
        ] }
      : {};
    const statusFilter: Prisma.SchoolWhereInput =
      status === 'accepted' ? { id: { in: acceptedIds } }
      : status === 'pending' ? { id: { notIn: acceptedIds } }
      : {};
    const where: Prisma.SchoolWhereInput = { AND: [search, statusFilter] };

    const [totalSchools, filteredTotal, schools] = await Promise.all([
      prisma.school.count(),
      prisma.school.count({ where }),
      prisma.school.findMany({
        where,
        orderBy: { name: 'asc' },
        ...(all ? {} : { skip: (page - 1) * pageSize, take: pageSize }),
        select: { id: true, schoolId: true, name: true, city: true, state: true, email: true, isActive: true },
      }),
    ]);

    // Accepted rows first (newest acceptance on top), then pending A–Z.
    const rows = schools
      .map(s => {
        const acceptance = byActor.get(s.id) ?? null;
        return { school: s, acceptance, reaccept: acceptance ? null : reacceptByActor.get(s.id) ?? null };
      })
      .sort((a, b) => {
        if (a.acceptance && b.acceptance) return b.acceptance.acceptedAt.getTime() - a.acceptance.acceptedAt.getTime();
        if (a.acceptance) return -1;
        if (b.acceptance) return 1;
        return 0;
      });

    // Acceptances whose school row is gone still have to be visible — that's
    // the whole point of keeping them FK-free.
    const schoolIds = new Set((await prisma.school.findMany({ where: { id: { in: acceptedIds } }, select: { id: true } })).map(s => s.id));
    const orphaned = [...byActor.keys()].filter(id => !schoolIds.has(id)).length;

    return NextResponse.json({
      role,
      documentKey: SCHOOL_AGREEMENT_KEY,
      currentVersion: SCHOOL_AGREEMENT_VERSION,
      summary: {
        total: totalSchools,
        accepted: byActor.size - orphaned,
        pending: totalSchools - (byActor.size - orphaned),
        orphaned,
      },
      rows,
      total: filteredTotal,
      page: all ? 1 : page,
      pageSize: all ? filteredTotal : pageSize,
      totalPages: all ? 1 : Math.max(1, Math.ceil(filteredTotal / pageSize)),
    });
  } catch (err) {
    console.error('GET dashboard/agreements failed:', err);
    return NextResponse.json({ message: 'Failed to load agreement records' }, { status: 500 });
  }
}

// Moderators accept the Terms & Conditions once, at first login; the record is
// the flag and timestamp on the Moderator row (see /api/staff/terms). There is
// no versioned document or IP capture for this gate, so only the time is shown.
async function moderatorRegister({ status, q, all, page, pageSize }: ListParams) {
  const search: Prisma.ModeratorWhereInput = q
    ? { OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { moderatorId: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ] }
    : {};
  const statusFilter: Prisma.ModeratorWhereInput =
    status === 'accepted' ? { termsAccepted: true }
    : status === 'pending' ? { termsAccepted: false }
    : {};
  const where: Prisma.ModeratorWhereInput = { AND: [search, statusFilter] };

  const [total, accepted, filteredTotal, moderators] = await Promise.all([
    prisma.moderator.count(),
    prisma.moderator.count({ where: { termsAccepted: true } }),
    prisma.moderator.count({ where }),
    prisma.moderator.findMany({
      where,
      // Accepted first (newest on top), then pending A–Z.
      orderBy: [{ termsAcceptedAt: { sort: 'desc', nulls: 'last' } }, { name: 'asc' }],
      ...(all ? {} : { skip: (page - 1) * pageSize, take: pageSize }),
      select: { id: true, moderatorId: true, name: true, email: true, isActive: true, createdAt: true, termsAccepted: true, termsAcceptedAt: true },
    }),
  ]);

  return {
    role: 'MODERATOR',
    document: 'Terms and Conditions',
    summary: { total, accepted, pending: total - accepted, orphaned: 0 },
    rows: moderators.map(({ termsAccepted, termsAcceptedAt, ...moderator }) => ({
      moderator,
      accepted: termsAccepted,
      acceptedAt: termsAcceptedAt,
    })),
    total: filteredTotal,
    page: all ? 1 : page,
    pageSize: all ? filteredTotal : pageSize,
    totalPages: all ? 1 : Math.max(1, Math.ceil(filteredTotal / pageSize)),
  };
}

// Evaluator Terms & Privacy Policy: one AgreementAcceptance per acceptance
// (version, text hash, IP, browser, reading times). An evaluator counts as
// accepted only while they hold an unrevoked record for the CURRENT version.
async function evaluatorRegister({ status, q, all, page, pageSize }: ListParams) {
  const acceptances = await prisma.agreementAcceptance.findMany({
    where: { role: 'EVALUATOR', documentKey: EVALUATOR_TERMS_KEY, documentVersion: EVALUATOR_TERMS_VERSION, revokedAt: null },
    orderBy: { acceptedAt: 'desc' },
    select: { id: true, actorId: true, acceptedAt: true, documentVersion: true, ipAddress: true, userAgent: true, readCompletedAt: true, documentHash: true },
  });
  const byActor = new Map<string, (typeof acceptances)[number]>();
  for (const a of acceptances) if (!byActor.has(a.actorId)) byActor.set(a.actorId, a);
  const acceptedIds = [...byActor.keys()];

  const search: Prisma.TalentEvaluatorWhereInput = q
    ? { OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { evaluatorId: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ] }
    : {};
  const statusFilter: Prisma.TalentEvaluatorWhereInput =
    status === 'accepted' ? { id: { in: acceptedIds } }
    : status === 'pending' ? { id: { notIn: acceptedIds } }
    : {};
  const where: Prisma.TalentEvaluatorWhereInput = { AND: [search, statusFilter] };

  const [total, accepted, filteredTotal, evaluators] = await Promise.all([
    prisma.talentEvaluator.count(),
    prisma.talentEvaluator.count({ where: { id: { in: acceptedIds } } }),
    prisma.talentEvaluator.count({ where }),
    prisma.talentEvaluator.findMany({
      where,
      orderBy: { name: 'asc' },
      ...(all ? {} : { skip: (page - 1) * pageSize, take: pageSize }),
      select: { id: true, evaluatorId: true, name: true, email: true, isActive: true, createdAt: true },
    }),
  ]);

  return {
    role: 'EVALUATOR',
    document: 'Evaluator Terms & Privacy Policy',
    currentVersion: EVALUATOR_TERMS_VERSION,
    summary: { total, accepted, pending: total - accepted, orphaned: 0 },
    rows: evaluators.map(evaluator => ({ evaluator, acceptance: byActor.get(evaluator.id) ?? null })),
    total: filteredTotal,
    page: all ? 1 : page,
    pageSize: all ? filteredTotal : pageSize,
    totalPages: all ? 1 : Math.max(1, Math.ceil(filteredTotal / pageSize)),
  };
}
