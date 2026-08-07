import { NextResponse } from 'next/server';
import { verify } from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { getJwtSecret } from '@/lib/auth-guard';

const JWT_SECRET = getJwtSecret();

function getAppUserFromToken(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  try {
    const decoded = verify(token, JWT_SECRET) as any;
    if (decoded.role !== 'APP_USER') return null;
    return decoded;
  } catch {
    return null;
  }
}

const RETENTION_DAYS = 30;

// GET /api/app/support/notifications?cursor=<id>&limit=12 — list the logged-in user's tickets
// that have a SuperAdmin response.
// Tickets themselves are kept forever for the admin dashboard's records — only replies older than
// the retention window stop showing up in the user's own notification feed, so nothing is deleted here.
export async function GET(request: Request) {
  const appUser = getAppUserFromToken(request);
  if (!appUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get('cursor') ?? undefined;
  const limit  = Math.min(parseInt(searchParams.get('limit') ?? '12', 10) || 12, 30);

  try {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

    const ticketsRaw = await prisma.supportTicket.findMany({
      where: {
        userId:        appUser.id,
        adminResponse: { not: null },
        respondedAt:   { gte: cutoff },
      },
      orderBy: { respondedAt: 'desc' },
      take:    limit + 1,
      cursor:  cursor ? { id: cursor } : undefined,
      skip:    cursor ? 1 : 0,
      select: {
        id: true,
        type: true,
        category: true,
        message: true,
        adminResponse: true,
        respondedAt: true,
        isReadByUser: true,
        createdAt: true,
      },
    });

    const hasMore   = ticketsRaw.length > limit;
    const tickets    = hasMore ? ticketsRaw.slice(0, limit) : ticketsRaw;
    const nextCursor = hasMore ? tickets[tickets.length - 1].id : null;

    return NextResponse.json({ notifications: tickets, nextCursor, hasMore });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
