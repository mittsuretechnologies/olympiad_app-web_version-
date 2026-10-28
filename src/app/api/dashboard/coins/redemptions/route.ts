import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { coinsAdmin, serverError } from '@/lib/coins/adminApi';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { error } = await coinsAdmin(request);
  if (error) return error;
  try {
    const status = new URL(request.url).searchParams.get('status');
    const rows = await prisma.coinRedemption.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true, status: true, code: true, coinsSpent: true, adminNote: true, createdAt: true,
        reward: { select: { title: true, kind: true } },
        appUser: { select: { userId: true, mobile: true, email: true } },
      },
    });
    return NextResponse.json({ redemptions: rows });
  } catch (e) {
    return serverError(e);
  }
}
