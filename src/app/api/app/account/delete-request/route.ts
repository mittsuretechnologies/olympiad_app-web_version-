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
  } catch {
    return null;
  }
}

// GET /api/app/account/delete-request — current deletion state for the
// Profile screen: whether a viewer's 30-day window is running, or a
// student's request is still awaiting SuperAdmin review.
export async function GET(request: Request) {
  const appUser = getAppUserFromToken(request);
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const user = await prisma.appUser.findUnique({
      where:  { id: appUser.id },
      select: { olympiadId: true, deletionRequestedAt: true },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const isStudent = !!user.olympiadId;

    if (isStudent) {
      const pending = await prisma.accountDeletionRequest.findFirst({
        where:  { appUserId: appUser.id, status: 'PENDING' },
        select: { createdAt: true },
      });
      return NextResponse.json({
        isStudent,
        pending: !!pending,
        requestedAt: pending?.createdAt ?? null,
      });
    }

    return NextResponse.json({
      isStudent,
      pending: !!user.deletionRequestedAt,
      requestedAt: user.deletionRequestedAt,
    });
  } catch (error: any) {
    console.error('account delete-request GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/app/account/delete-request — "Delete Account" tap on Profile.
// Branches purely on whether the account has an olympiadId, same rule the
// SuperAdmin dashboard already uses to tell Viewer from Student:
//   - Viewer: stamps deletionRequestedAt now. From this instant the account
//     and its videos are hidden from everyone (see visibilityWhere /
//     users/[userId]) and the client logs the user out. Logging back in
//     within 30 days (see the login route) clears this and undoes everything.
//     A background sweep hard-deletes anyone still flagged 30+ days later.
//   - Student: creates an AccountDeletionRequest instead. Nothing is hidden
//     or changed — the account stays fully live until a SuperAdmin reviews
//     it in the dashboard.
export async function POST(request: Request) {
  const appUser = getAppUserFromToken(request);
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const user = await prisma.appUser.findUnique({
      where:  { id: appUser.id },
      select: { olympiadId: true, deletionRequestedAt: true },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const isStudent = !!user.olympiadId;

    if (isStudent) {
      const existing = await prisma.accountDeletionRequest.findFirst({
        where: { appUserId: appUser.id, status: 'PENDING' },
      });
      if (existing) {
        return NextResponse.json({
          mode: 'STUDENT_REQUESTED', pending: true, requestedAt: existing.createdAt,
        });
      }
      const created = await prisma.accountDeletionRequest.create({
        data: { appUserId: appUser.id },
      });
      return NextResponse.json({
        mode: 'STUDENT_REQUESTED', pending: true, requestedAt: created.createdAt,
      });
    }

    const deletionRequestedAt = user.deletionRequestedAt ?? new Date();
    if (!user.deletionRequestedAt) {
      await prisma.appUser.update({
        where: { id: appUser.id },
        data:  { deletionRequestedAt },
      });
    }
    const deleteAt = new Date(deletionRequestedAt.getTime() + 30 * 24 * 60 * 60 * 1000);
    return NextResponse.json({ mode: 'VIEWER_SCHEDULED', pending: true, requestedAt: deletionRequestedAt, deleteAt });
  } catch (error: any) {
    console.error('account delete-request POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
