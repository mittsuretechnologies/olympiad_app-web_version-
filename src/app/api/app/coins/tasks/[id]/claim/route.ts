import { NextResponse } from 'next/server';
import { requireAppUser } from '@/lib/coins/appAuth';
import { coinErrorResponse } from '@/lib/coins/ledger';
import { claimTask } from '@/lib/coins/tasks';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId, error } = requireAppUser(request);
  if (error) return error;
  try {
    const { id } = await params;
    return NextResponse.json(await claimTask(userId, id));
  } catch (e) {
    return coinErrorResponse(e);
  }
}
