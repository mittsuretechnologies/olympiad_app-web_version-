import { NextResponse } from 'next/server';
import { verify } from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

function getAppUserFromToken(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  try {
    const decoded = verify(token, JWT_SECRET) as any;
    if (decoded.role !== 'APP_USER') return null;
    return decoded;
  } catch { return null; }
}

// GET /api/app/follow-requests — list pending follow requests received by current user
export async function GET(request: Request) {
  const appUser = getAppUserFromToken(request);
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const requests = await prisma.followRequest.findMany({
    where:   { receiverId: appUser.id, status: 'PENDING' },
    orderBy: { createdAt: 'desc' },
    select: {
      id:        true,
      createdAt: true,
      sender: {
        select: {
          id:        true,
          userId:    true,
          avatarUrl: true,
          olympiadId: true,
        },
      },
    },
  });

  return NextResponse.json(requests);
}
