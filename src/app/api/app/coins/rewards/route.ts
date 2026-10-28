import { NextResponse } from 'next/server';
import { requireAppUser } from '@/lib/coins/appAuth';
import { coinErrorResponse } from '@/lib/coins/ledger';
import { listRewardsForUser } from '@/lib/coins/rewards';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { userId, error } = requireAppUser(request);
  if (error) return error;
  try {
    return NextResponse.json(await listRewardsForUser(userId));
  } catch (e) {
    return coinErrorResponse(e);
  }
}
