import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth-guard';
import {
  SCHOOL_AGREEMENT,
  SCHOOL_AGREEMENT_KEY,
  SCHOOL_AGREEMENT_VERSION,
  schoolAgreementDeclarations,
} from '@/lib/agreements/school-onboarding';
import { clientIp, userAgent, schoolAgreementHash } from '@/lib/agreements/server';
import {
  GENERAL_SCHOOL_AGREEMENT_ROLE,
  currentGeneralSchoolAcceptance,
  generalSchoolDetailsSnapshot,
  getGeneralSchoolForUser,
  plausibleDate,
} from '@/lib/generalSchool';

export const dynamic = 'force-dynamic';

// The School Onboarding Agreement gate for a logged-in General School.
//
// At sign-up the agreement is accepted as part of registration. This route
// exists for the later cases: a Super Admin revoked the acceptance, or the
// agreement version was bumped (Section 17.2 re-shows it to every school).
//   GET  -> accepted? (+ the document, so the app can show it if not)
//   POST -> record the acceptance

async function loadSchool(appUserId: string) {
  const school = await getGeneralSchoolForUser(appUserId);
  return school;
}

export async function GET(request: Request) {
  const { payload, error } = requireRole(request, ['APP_USER']);
  if (error) return error;

  try {
    const school = await loadSchool(payload.id);
    if (!school) return NextResponse.json({ message: 'Not a school account' }, { status: 403 });

    const acceptance = await currentGeneralSchoolAcceptance(school.id);
    return NextResponse.json({
      accepted: Boolean(acceptance),
      currentVersion: SCHOOL_AGREEMENT_VERSION,
      acceptance,
      // Only sent when it is needed - the document is large.
      ...(acceptance ? {} : {
        key: SCHOOL_AGREEMENT_KEY,
        document: SCHOOL_AGREEMENT,
        declarations: schoolAgreementDeclarations(),
      }),
    });
  } catch (err) {
    console.error('GET app/school/agreement failed:', err);
    return NextResponse.json({ message: 'Could not load the agreement status.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { payload, error } = requireRole(request, ['APP_USER']);
  if (error) return error;

  try {
    const body = await request.json().catch(() => null);
    if (!body) return NextResponse.json({ message: 'Invalid request.' }, { status: 400 });

    // Never record an acceptance against wording the school did not see.
    if (body.documentVersion !== SCHOOL_AGREEMENT_VERSION) {
      return NextResponse.json(
        { message: 'The agreement has been updated. Please reload and read the latest version.' },
        { status: 409 },
      );
    }

    const school = await loadSchool(payload.id);
    if (!school) return NextResponse.json({ message: 'Not a school account' }, { status: 403 });

    const declarations = schoolAgreementDeclarations();
    if (
      !Array.isArray(body.declarations) ||
      body.declarations.length !== declarations.length ||
      !body.declarations.every((d: unknown) => d === true)
    ) {
      return NextResponse.json({ message: 'Please tick all the declarations to accept.' }, { status: 400 });
    }

    const existing = await currentGeneralSchoolAcceptance(school.id);
    if (existing) return NextResponse.json({ accepted: true, acceptance: existing });

    const user = await prisma.appUser.findUnique({ where: { id: payload.id }, select: { userId: true } });
    const now = new Date();

    // The school is already authenticated by its own password, which is what
    // this re-acceptance is verified by (same idea as the Olympiad portal's
    // ACCOUNT_LOGIN channel).
    const record = await prisma.agreementAcceptance.create({
      data: {
        role: GENERAL_SCHOOL_AGREEMENT_ROLE,
        actorId: school.id,
        actorCode: user?.userId ?? null,
        actorName: school.name,
        documentKey: SCHOOL_AGREEMENT_KEY,
        documentVersion: SCHOOL_AGREEMENT_VERSION,
        documentHash: schoolAgreementHash(),
        signatoryName: school.contactPerson || school.name,
        signatoryDesignation: 'Authorised Representative (via school account in the Mittmee app)',
        signatoryPhone: school.mobile,
        details: generalSchoolDetailsSnapshot({ ...school, userId: user?.userId }),
        declarations,
        verificationChannel: 'ACCOUNT_LOGIN',
        verificationTarget: user?.userId ?? school.id,
        verifiedAt: now,
        ipAddress: clientIp(request),
        userAgent: userAgent(request),
        readStartedAt: plausibleDate(body.readStartedAt),
        readCompletedAt: plausibleDate(body.readCompletedAt),
        acceptedAt: now,
      },
    });

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
    });
  } catch (err) {
    console.error('POST app/school/agreement failed:', err);
    return NextResponse.json({ message: 'Could not record your acceptance. Please try again.' }, { status: 500 });
  }
}
