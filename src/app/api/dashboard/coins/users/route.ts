import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { coinsAdmin, serverError } from '@/lib/coins/adminApi';

export const dynamic = 'force-dynamic';

// Find a user's wallet by user ID, mobile or email; with no search, the top holders.
export async function GET(request: Request) {
  const { error } = await coinsAdmin(request);
  if (error) return error;
  try {
    const q = (new URL(request.url).searchParams.get('q') ?? '').trim();
    const rows = await prisma.coinWallet.findMany({
      where: q
        ? { appUser: { OR: [
            { userId: { contains: q, mode: 'insensitive' } },
            { mobile: { contains: q } },
            { email: { contains: q, mode: 'insensitive' } },
          ] } }
        : undefined,
      orderBy: { balance: 'desc' },
      take: 25,
      select: {
        appUserId: true, balance: true, lifetimeEarned: true, lifetimeSpent: true, currentStreak: true, longestStreak: true,
        appUser: { select: { userId: true, mobile: true, email: true } },
      },
    });
    return NextResponse.json({ wallets: rows });
  } catch (e) {
    return serverError(e);
  }
}
