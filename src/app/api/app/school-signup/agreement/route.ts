import { NextResponse } from 'next/server';
import {
  SCHOOL_AGREEMENT,
  SCHOOL_AGREEMENT_KEY,
  SCHOOL_AGREEMENT_VERSION,
  schoolAgreementDeclarations,
} from '@/lib/agreements/school-onboarding';

export const dynamic = 'force-dynamic';

// GET /api/app/school-signup/agreement
// The exact School Onboarding Agreement an Olympiad school accepts on its
// first web login, served as data so the app can render it for a school that
// is signing up. Public on purpose: it is read before an account exists.
export async function GET() {
  return NextResponse.json({
    key: SCHOOL_AGREEMENT_KEY,
    version: SCHOOL_AGREEMENT_VERSION,
    document: SCHOOL_AGREEMENT,
    declarations: schoolAgreementDeclarations(),
  });
}
