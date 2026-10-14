import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendCopyrightReviewReminderEmail } from '@/lib/mailer';
import { formatReviewDate } from '@/lib/copyright';
import { reviewDueWhere } from '@/lib/infringementNotices';
import { videoLabel } from '@/lib/videoUploader';

export const dynamic = 'force-dynamic';

// Daily reminder to the grievance inbox for copyright takedowns whose 21-day
// review is due within two days or overdue. Each notice is reminded once; an
// extended review date clears that, so it is reminded again before the new date.
//
// Run once a day from the server's crontab with CRON_SECRET as a Bearer token,
// like /api/cron/sweep-deleted-accounts.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date();
    const due = await prisma.infringementNotice.findMany({
      where: { ...reviewDueWhere(now), reviewReminderSentAt: null },
      orderBy: { reviewDueAt: 'asc' },
      select: {
        id: true, referenceId: true, fullName: true, reviewDueAt: true,
        video: { select: { caption: true, category: true, subCategory: true } },
      },
    });
    if (due.length === 0) return NextResponse.json({ reminded: 0 });

    const base = (process.env.SERVER_URL || '').replace(/\/+$/, '');
    await sendCopyrightReviewReminderEmail(
      due.map((n) => ({
        referenceId: n.referenceId,
        complainantName: n.fullName,
        videoLabel: n.video ? videoLabel(n.video) : '(video unlinked)',
        reviewDate: formatReviewDate(n.reviewDueAt!),
        overdue: n.reviewDueAt! <= now,
      })),
      `${base}/dashboard/infringement-notices`,
    );
    await prisma.infringementNotice.updateMany({
      where: { id: { in: due.map((n) => n.id) } },
      data: { reviewReminderSentAt: now },
    });

    return NextResponse.json({ reminded: due.length, referenceIds: due.map((n) => n.referenceId) });
  } catch (error: any) {
    console.error('infringement-reviews cron error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
