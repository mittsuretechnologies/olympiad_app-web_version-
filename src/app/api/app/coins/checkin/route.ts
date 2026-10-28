import { NextResponse } from 'next/server';
import { requireAppUser } from '@/lib/coins/appAuth';
import { coinErrorResponse } from '@/lib/coins/ledger';
import { performCheckin } from '@/lib/coins/streak';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const { userId, error } = requireAppUser(request);
  if (error) return error;
  try {
    return NextResponse.json(await performCheckin(userId));
  } catch (e) {
    return coinErrorResponse(e);
  }
}
