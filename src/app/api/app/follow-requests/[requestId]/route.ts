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

// PATCH /api/app/follow-requests/:requestId — approve or reject a follow request
// Body: { action: 'approve' | 'reject' }
export async function PATCH(request: Request, { params }: { params: Promise<{ requestId: string }> }) {
  const appUser = getAppUserFromToken(request);
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { requestId } = await params;
  const { action } = await request.json();

  if (action !== 'approve' && action !== 'reject') {
    return NextResponse.json({ error: 'action must be approve or reject' }, { status: 400 });
  }

  const followRequest = await prisma.followRequest.findUnique({ where: { id: requestId } });
  if (!followRequest) return NextResponse.json({ error: 'Request not found' }, { status: 404 });
  if (followRequest.receiverId !== appUser.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (followRequest.status !== 'PENDING') return NextResponse.json({ error: 'Request already handled' }, { status: 409 });

  if (action === 'approve') {
    // Create the Follow record and mark request approved
    await prisma.$transaction([
      prisma.follow.upsert({
        where: { followerId_followingId: { followerId: followRequest.senderId, followingId: followRequest.receiverId } },
        create: { followerId: followRequest.senderId, followingId: followRequest.receiverId },
        update: {},
      }),
      prisma.followRequest.update({ where: { id: requestId }, data: { status: 'APPROVED' } }),
    ]);
    return NextResponse.json({ status: 'APPROVED' });
  }

  // reject
  await prisma.followRequest.update({ where: { id: requestId }, data: { status: 'REJECTED' } });
  return NextResponse.json({ status: 'REJECTED' });
}
