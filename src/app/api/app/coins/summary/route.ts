import { NextResponse } from 'next/server';
import { requireAppUser } from '@/lib/coins/appAuth';
import { coinErrorResponse } from '@/lib/coins/ledger';
import { coinSummary } from '@/lib/coins/summary';

export const dynamic = 'force-dynamic';

// Wallet, streak, ladder, tasks and game list in one round trip.
export async function GET(request: Request) {
  const { userId, error } = requireAppUser(request);
  if (error) return error;
  try {
    return NextResponse.json(await coinSummary(userId));
  } catch (e) {
    return coinErrorResponse(e);
  }
}
