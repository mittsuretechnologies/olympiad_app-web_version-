import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth-guard';

// GET /api/dashboard/account-deletion-requests
// Every student account-deletion request — PENDING first (oldest first, so
// the longest-waiting request surfaces at the top), then the REJECTED
// history. Approved requests never appear here: approving one wipes the
// AppUser row entirely (see the [id] route), and this row cascades away
// with it — there is nothing left to list.
export async function GET(request: Request) {
  const { error } = requireRole(request, ['SUPERADMIN']);
  if (error) return error;

  try {
    const requests = await prisma.accountDeletionRequest.findMany({
      orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true, status: true, createdAt: true, decidedAt: true,
        appUser: {
          select: {
            id: true, userId: true, email: true, mobile: true,
            olympiadId: true, avatarUrl: true, createdAt: true,
          },
        },
      },
    });

    return NextResponse.json(requests.map(r => ({
      id:         r.id,
      status:     r.status,
      createdAt:  r.createdAt,
      decidedAt:  r.decidedAt,
      appUserId:  r.appUser.id,
      username:   r.appUser.userId,
      email:      r.appUser.email,
      mobile:     r.appUser.mobile,
      olympiadId: r.appUser.olympiadId,
      avatarUrl:  r.appUser.avatarUrl,
      joinedAt:   r.appUser.createdAt,
    })));
  } catch (error) {
    console.error('GET /api/dashboard/account-deletion-requests failed:', error);
    return NextResponse.json({ message: 'Failed to fetch requests' }, { status: 500 });
  }
}
