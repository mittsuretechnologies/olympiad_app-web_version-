import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hardDeleteAppUser } from '@/lib/accountDeletion';

// Daily sweep for viewers whose 30-day grace window has run out.
// Students never get deletionRequestedAt set by this app (they go through
// AccountDeletionRequest + SuperAdmin approval instead), but this query
// filters on olympiadId: null anyway, defensively — this endpoint should
// only ever touch the viewer path.
//
// Triggered by Vercel Cron (see vercel.json) once a day. Protected by
// CRON_SECRET so it can't be hit by anyone who finds the URL — Vercel Cron
// sends this automatically as a Bearer token on every invocation it makes.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const due = await prisma.appUser.findMany({
      where:  { olympiadId: null, deletionRequestedAt: { lte: cutoff } },
      select: { id: true, userId: true },
    });

    for (const user of due) {
      await hardDeleteAppUser(user.id);
    }

    return NextResponse.json({ deletedCount: due.length, deletedUserIds: due.map(u => u.userId) });
  } catch (error: any) {
    console.error('sweep-deleted-accounts error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
