import { NextResponse } from 'next/server';
import { requireAppUser } from '@/lib/coins/appAuth';
import { coinErrorResponse } from '@/lib/coins/ledger';
import { referralSummary } from '@/lib/coins/referral';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { userId, error } = requireAppUser(request);
  if (error) return error;
  try {
    return NextResponse.json(await referralSummary(userId));
  } catch (e) {
    return coinErrorResponse(e);
  }
}
