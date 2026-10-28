import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAppUser } from '@/lib/coins/appAuth';

export const dynamic = 'force-dynamic';

const PAGE = 30;

// Newest first, cursor-paged so a long history never loads at once.
export async function GET(request: Request) {
  const { userId, error } = requireAppUser(request);
  if (error) return error;
  const cursor = new URL(request.url).searchParams.get('cursor');
  const rows = await prisma.coinTransaction.findMany({
    where: { appUserId: userId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: PAGE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: { id: true, amount: true, type: true, note: true, createdAt: true, balanceAfter: true },
  });
  const more = rows.length > PAGE;
  const items = more ? rows.slice(0, PAGE) : rows;
  return NextResponse.json({
    items: items.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
    nextCursor: more ? items[items.length - 1].id : null,
  });
}
