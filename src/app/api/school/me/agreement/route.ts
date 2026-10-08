import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth-guard';
import {
  SCHOOL_AGREEMENT_KEY,
  SCHOOL_AGREEMENT_VERSION,
  schoolAgreementDeclarations,
} from '@/lib/agreements/school-onboarding';
import {
  clientIp,
  isEmail,
  maskEmail,
  maskPhone,
  schoolDetailsSnapshot,
  ACCEPTED_VIA,
  schoolAgreementHash,
  userAgent,
} from '@/lib/agreements/server';

export const dynamic = 'force-dynamic';

// School Onboarding Agreement gate for the School Panel.
// GET  -> has this school accepted the current version? (+ prefill data)
// POST -> record the acceptance (Section 18). There is no separate OTP step:
//         the acceptance is made from the school's own authenticated admin
//         account, which is recorded as the verification (ACCOUNT_LOGIN).
// Identity always comes from the JWT, never the body.

const SCHOOL_SELECT = {
  id: true, schoolId: true, name: true, address: true, city: true, district: true,
  state: true, pincode: true, email: true, phone: true, contactPerson: true,
} as const;

// The school's current acceptance: its newest unrevoked one for this version.
// A SuperAdmin can revoke it to ask the school to accept again; the revoked
// row stays as evidence and the gate shows until a new one is recorded.
function currentAcceptance(schoolId: string) {
  return prisma.agreementAcceptance.findFirst({
    where: {
      role: 'SCHOOL', actorId: schoolId,
      documentKey: SCHOOL_AGREEMENT_KEY, documentVersion: SCHOOL_AGREEMENT_VERSION,
      revokedAt: null,
    },
    orderBy: { acceptedAt: 'desc' },
    select: { id: true, acceptedAt: true, signatoryName: true, signatoryDesignation: true, documentVersion: true, ipAddress: true },
  });
}

export async function GET(request: Request) {
  const { payload, error } = requireRole(request, ['SCHOOL']);
  if (error) return error;

  try {
    const school = await prisma.school.findUnique({ where: { id: payload.id }, select: SCHOOL_SELECT });
    if (!school) return NextResponse.json({ message: 'School not found' }, { status: 404 });

    const acceptance = await currentAcceptance(school.id);
    return NextResponse.json({
      accepted: Boolean(acceptance),
      currentVersion: SCHOOL_AGREEMENT_VERSION,
      acceptance,
      school: {
        name: school.name, schoolId: school.schoolId, address: school.address, city: school.city,
        district: school.district, state: school.state, pincode: school.pincode,
        email: school.email, phone: school.phone, contactPerson: school.contactPerson,
      },
      contact: {
        email: isEmail(school.email) ? maskEmail(school.email!) : null,
        phone: school.phone ? maskPhone(school.phone) : null,
      },
    });
  } catch (err) {
    console.error('GET school/me/agreement failed:', err);
    return NextResponse.json({ message: 'Could not load the agreement status.' }, { status: 500 });
  }
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

export async function POST(request: Request) {
  const { payload, error } = requireRole(request, ['SCHOOL']);
  if (error) return error;

  try {
    const body = await request.json().catch(() => null);
    if (!body) return NextResponse.json({ message: 'Invalid request.' }, { status: 400 });

    // The page may have been open across a version bump — never record an
    // acceptance against wording the representative didn't see.
    if (body.documentVersion !== SCHOOL_AGREEMENT_VERSION) {
      return NextResponse.json(
        { message: 'The agreement has been updated. Please reload the page and read the latest version.' },
        { status: 409 },
      );
    }

    const school = await prisma.school.findUnique({ where: { id: payload.id }, select: SCHOOL_SELECT });
    if (!school) return NextResponse.json({ message: 'School not found' }, { status: 404 });

    const declarations = schoolAgreementDeclarations();
    if (!Array.isArray(body.declarations) || body.declarations.length !== declarations.length || !body.declarations.every((d: unknown) => d === true)) {
      return NextResponse.json({ message: 'Please tick all the declarations to accept.' }, { status: 400 });
    }

    const existing = await currentAcceptance(school.id);
    if (existing) return NextResponse.json({ accepted: true, acceptance: existing });

    const now = new Date();
    const details = schoolDetailsSnapshot(school);

    // No unique index: a revoked acceptance can be followed by a new one for
    // the same version. The existing-acceptance check above and the disabled
    // button cover double submits.
    const record = await prisma.agreementAcceptance.create({
      data: {
        role: 'SCHOOL',
        actorId: school.id,
        actorCode: school.schoolId,
        actorName: school.name,
        documentKey: SCHOOL_AGREEMENT_KEY,
        documentVersion: SCHOOL_AGREEMENT_VERSION,
        documentHash: schoolAgreementHash(),
        signatoryName: school.name,
        signatoryDesignation: ACCEPTED_VIA,
        signatoryPhone: null,
        details,
        declarations,
        verificationChannel: 'ACCOUNT_LOGIN',
        verificationTarget: school.schoolId,
        verifiedAt: now,
        ipAddress: clientIp(request),
        userAgent: userAgent(request),
        readStartedAt: plausibleDate(body.readStartedAt),
        readCompletedAt: plausibleDate(body.readCompletedAt),
        acceptedAt: now,
      },
    });

    // No automatic email: the copy of the agreement (Section 18.4) is not
    // sent on acceptance or re-acceptance.

    return NextResponse.json({
      accepted: true,
      acceptance: {
        id: record.id,
        acceptedAt: record.acceptedAt,
        signatoryName: record.signatoryName,
        signatoryDesignation: record.signatoryDesignation,
        documentVersion: record.documentVersion,
        ipAddress: record.ipAddress,
      },
      emailedTo: [],
    });
  } catch (err) {
    console.error('POST school/me/agreement failed:', err);
    return NextResponse.json({ message: 'Could not record your acceptance. Please try again.' }, { status: 500 });
  }
}
