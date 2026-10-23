import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth-guard';
import { recordAuditLog } from '@/lib/audit-log';
import { clientIp, userAgent } from '@/lib/agreements/server';
import {
  EVALUATOR_TERMS_DECLARATIONS,
  EVALUATOR_TERMS_KEY,
  EVALUATOR_TERMS_VERSION,
} from '@/lib/evaluatorTerms';
import { evaluatorTermsHash } from '@/lib/evaluatorTermsServer';

export const dynamic = 'force-dynamic';

// Terms & Conditions gate for Moderator / Evaluator dashboard access.
// GET  -> whether the logged-in staff member still needs to accept.
// POST -> record acceptance (identity always comes from the JWT, not the client).
//
// MODERATOR: the termsAccepted flag + time on the Moderator row.
// EVALUATOR: a full AgreementAcceptance record (version, SHA-256 of the exact
//   text shown, declarations, IP, browser, reading times) like the School
//   agreement, plus the flag/time on the TalentEvaluator row. An evaluator is
//   "accepted" only while they have an unrevoked record for the CURRENT
//   version, so bumping EVALUATOR_TERMS_VERSION (or a SuperAdmin revoking the
//   record on the Agreements page) asks them to accept again.

const GATED_ROLES = ['MODERATOR', 'EVALUATOR'];

function currentEvaluatorAcceptance(evaluatorId: string) {
  return prisma.agreementAcceptance.findFirst({
    where: {
      role: 'EVALUATOR', actorId: evaluatorId,
      documentKey: EVALUATOR_TERMS_KEY, documentVersion: EVALUATOR_TERMS_VERSION,
      revokedAt: null,
    },
    orderBy: { acceptedAt: 'desc' },
    select: { id: true, acceptedAt: true },
  });
}

/** Client-reported reading timestamps: kept only when plausible. */
function plausibleDate(v: unknown): Date | null {
  if (typeof v !== 'string') return null;
  const d = new Date(v);
  const t = d.getTime();
  if (Number.isNaN(t)) return null;
  const now = Date.now();
  return t <= now + 5 * 60_000 && t >= now - 24 * 3_600_000 ? d : null;
}

export async function GET(request: Request) {
  const { payload, error } = requireRole(request, GATED_ROLES);
  if (error) return error;

  if (payload.role === 'EVALUATOR') {
    const evaluator = await prisma.talentEvaluator.findUnique({ where: { id: payload.id }, select: { id: true } });
    if (!evaluator) return NextResponse.json({ message: 'Account not found' }, { status: 404 });
    const acceptance = await currentEvaluatorAcceptance(evaluator.id);
    return NextResponse.json({
      termsAccepted: Boolean(acceptance),
      termsAcceptedAt: acceptance?.acceptedAt ?? null,
      documentVersion: EVALUATOR_TERMS_VERSION,
    });
  }

  const record = await prisma.moderator.findUnique({
    where: { id: payload.id },
    select: { termsAccepted: true, termsAcceptedAt: true },
  });
  if (!record) return NextResponse.json({ message: 'Account not found' }, { status: 404 });

  return NextResponse.json({
    termsAccepted: record.termsAccepted,
    termsAcceptedAt: record.termsAcceptedAt,
  });
}

export async function POST(request: Request) {
  const { payload, error } = requireRole(request, GATED_ROLES);
  if (error) return error;

  const now = new Date();

  if (payload.role === 'MODERATOR') {
    await prisma.moderator.update({
      where: { id: payload.id },
      data: { termsAccepted: true, termsAcceptedAt: now },
    });
    return NextResponse.json({ termsAccepted: true, termsAcceptedAt: now });
  }

  try {
    const body = await request.json().catch(() => null);
    if (!body) return NextResponse.json({ message: 'Invalid request.' }, { status: 400 });

    // The page may have been open across a version bump — never record an
    // acceptance against wording the evaluator didn't see.
    if (body.documentVersion !== EVALUATOR_TERMS_VERSION) {
      return NextResponse.json(
        { message: 'The terms have been updated. Please reload the page and read the latest version.' },
        { status: 409 },
      );
    }
    if (
      !Array.isArray(body.declarations) ||
      body.declarations.length !== EVALUATOR_TERMS_DECLARATIONS.length ||
      !body.declarations.every((d: unknown) => d === true)
    ) {
      return NextResponse.json({ message: 'Please tick all the declarations to accept.' }, { status: 400 });
    }

    const evaluator = await prisma.talentEvaluator.findUnique({
      where: { id: payload.id },
      select: { id: true, evaluatorId: true, name: true, email: true },
    });
    if (!evaluator) return NextResponse.json({ message: 'Account not found' }, { status: 404 });

    const existing = await currentEvaluatorAcceptance(evaluator.id);
    if (existing) return NextResponse.json({ termsAccepted: true, termsAcceptedAt: existing.acceptedAt });

    // No unique index: a revoked acceptance can be followed by a new one for
    // the same version. The check above and the disabled button cover double submits.
    const record = await prisma.agreementAcceptance.create({
      data: {
        role: 'EVALUATOR',
        actorId: evaluator.id,
        actorCode: evaluator.evaluatorId,
        actorName: evaluator.name,
        documentKey: EVALUATOR_TERMS_KEY,
        documentVersion: EVALUATOR_TERMS_VERSION,
        documentHash: evaluatorTermsHash(),
        signatoryName: evaluator.name,
        signatoryDesignation: 'Evaluator (accepted from own portal login)',
        signatoryPhone: null,
        details: { evaluatorId: evaluator.evaluatorId, name: evaluator.name, email: evaluator.email },
        declarations: EVALUATOR_TERMS_DECLARATIONS,
        verificationChannel: 'ACCOUNT_LOGIN',
        verificationTarget: evaluator.evaluatorId,
        verifiedAt: now,
        ipAddress: clientIp(request),
        userAgent: userAgent(request),
        readStartedAt: plausibleDate(body.readStartedAt),
        readCompletedAt: plausibleDate(body.readCompletedAt),
        acceptedAt: now,
      },
    });

    // Keep the flag on the evaluator row in step (used by older code paths).
    await prisma.talentEvaluator.update({
      where: { id: evaluator.id },
      data: { termsAccepted: true, termsAcceptedAt: now },
    });

    await recordAuditLog({
      actorId: evaluator.id,
      actorRole: 'EVALUATOR',
      actorName: evaluator.name,
      action: 'EVALUATOR_TERMS_ACCEPTED',
      entityType: 'AgreementAcceptance',
      entityId: record.id,
      newValue: { documentVersion: EVALUATOR_TERMS_VERSION, documentHash: record.documentHash, evaluatorId: evaluator.evaluatorId },
    });

    return NextResponse.json({ termsAccepted: true, termsAcceptedAt: record.acceptedAt });
  } catch (err) {
    console.error('POST staff/terms (evaluator) failed:', err);
    return NextResponse.json({ message: 'Could not record your acceptance. Please try again.' }, { status: 500 });
  }
}
