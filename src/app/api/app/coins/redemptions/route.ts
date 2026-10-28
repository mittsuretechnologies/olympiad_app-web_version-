import { NextResponse } from 'next/server';
import { requireAppUser } from '@/lib/coins/appAuth';
import { redemptionsForUser } from '@/lib/coins/rewards';

export const dynamic = 'force-dynamic';

// "My Coupons".
export async function GET(request: Request) {
  const { userId, error } = requireAppUser(request);
  if (error) return error;
  return NextResponse.json({ items: await redemptionsForUser(userId) });
}
