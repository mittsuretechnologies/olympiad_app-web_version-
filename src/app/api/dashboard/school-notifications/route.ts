import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth-guard';
import { notifySchools } from '@/lib/schoolNotifications';
import { isPanelLink, NOTIFICATION_LIMITS } from '@/lib/schoolNotificationConfig';

export const dynamic = 'force-dynamic';

// Rows sent from this page: an ANNOUNCEMENT that didn't come from App
// Notifications (those carry a broadcastId and are managed on that page).
const SENT_HERE = { type: 'ANNOUNCEMENT', broadcastId: null } as const;

const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !!x.trim()) : []);

// POST /api/dashboard/school-notifications
//   { title, message, link?, target: { mode: 'ALL' } | { mode: 'STATE', states: string[] } | { mode: 'SCHOOLS', schoolIds: string[] /* school codes */ } }
// Puts one notification in the bell of every active school the target reaches.
export async function POST(request: Request) {
  const { payload, error } = await requireAdmin(request, 'schools.view');
  if (error) return error;
  try {
    const body = await request.json().catch(() => ({}));
    const title = typeof body?.title === 'string' ? body.title.trim() : '';
    const message = typeof body?.message === 'string' ? body.message.trim() : '';
    if (!title || !message) return NextResponse.json({ message: 'Title and message are required' }, { status: 400 });
    if (title.length > NOTIFICATION_LIMITS.title) return NextResponse.json({ message: `Title can be at most ${NOTIFICATION_LIMITS.title} characters` }, { status: 400 });
    if (message.length > NOTIFICATION_LIMITS.message) return NextResponse.json({ message: `Message can be at most ${NOTIFICATION_LIMITS.message} characters` }, { status: 400 });
    const link = body?.link ? (isPanelLink(body.link) ? body.link : null) : null;
    if (body?.link && !link) return NextResponse.json({ message: 'Link must be a School Panel page like /school/passports' }, { status: 400 });

    const mode = body?.target?.mode;
    let where: Record<string, any> = { isActive: true };
    if (mode === 'STATE') {
      const states = strings(body.target.states);
      if (states.length === 0) return NextResponse.json({ message: 'Pick at least one state' }, { status: 400 });
      where = { ...where, state: { in: states } };
    } else if (mode === 'SCHOOLS') {
      const codes = strings(body.target.schoolIds);
      if (codes.length === 0) return NextResponse.json({ message: 'Pick at least one school' }, { status: 400 });
      where = { ...where, schoolId: { in: codes } };
    } else if (mode !== 'ALL') {
      return NextResponse.json({ message: 'Invalid target' }, { status: 400 });
    }

    const schools = await prisma.school.findMany({ where, select: { id: true } });
    if (schools.length === 0) return NextResponse.json({ message: 'No active schools match that target' }, { status: 400 });

    const sent = await notifySchools(schools.map(s => s.id), { type: 'ANNOUNCEMENT', title, message, link, createdBy: payload?.id ?? null });
    if (sent === 0) return NextResponse.json({ message: 'Could not send the notification' }, { status: 500 });
    return NextResponse.json({ sent });
  } catch (err) {
    console.error('POST school-notifications failed:', err);
    return NextResponse.json({ message: 'Failed to send notification' }, { status: 500 });
  }
}

// GET -> the latest 30 announcements sent from this page, one entry per
// broadcast (rows created together share a createdAt), with how many schools
// got it and how many have read it.
export async function GET(request: Request) {
  const { error } = await requireAdmin(request, 'schools.view');
  if (error) return error;
  try {
    const groups = await prisma.schoolNotification.groupBy({
      by: ['createdAt', 'title'],
      where: SENT_HERE,
      _count: { _all: true },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    if (groups.length === 0) return NextResponse.json({ history: [] });

    const times = Array.from(new Set(groups.map(g => g.createdAt.getTime()))).map(t => new Date(t));
    const [read, samples] = await Promise.all([
      prisma.schoolNotification.groupBy({
        by: ['createdAt', 'title'],
        where: { ...SENT_HERE, createdAt: { in: times }, readAt: { not: null } },
        _count: { _all: true },
      }),
      prisma.schoolNotification.findMany({
        where: { ...SENT_HERE, createdAt: { in: times } },
        distinct: ['createdAt', 'title'],
        select: { createdAt: true, title: true, message: true, link: true },
      }),
    ]);
    const key = (r: { createdAt: Date; title: string }) => `${r.createdAt.getTime()}|${r.title}`;
    const readBy = new Map(read.map(r => [key(r), r._count._all]));
    const sampleBy = new Map(samples.map(s => [key(s), s]));

    const history = groups.map(g => ({
      title: g.title,
      message: sampleBy.get(key(g))?.message ?? '',
      link: sampleBy.get(key(g))?.link ?? null,
      sentAt: g.createdAt,
      recipients: g._count._all,
      read: readBy.get(key(g)) ?? 0,
    }));
    return NextResponse.json({ history });
  } catch (err) {
    console.error('GET school-notifications failed:', err);
    return NextResponse.json({ message: 'Failed to load sent notifications' }, { status: 500 });
  }
}

// DELETE { sentAt, title } -> recall one announcement sent from this page: it
// disappears from every school's bell. Only that broadcast's rows match
// (same createdAt and title, sent here — never App Notifications rows or
// automatic passport / Olympiad ID notifications).
export async function DELETE(request: Request) {
  const { error } = await requireAdmin(request, 'schools.view');
  if (error) return error;
  try {
    const body = await request.json().catch(() => ({}));
    const title = typeof body?.title === 'string' ? body.title : '';
    const sentAt = typeof body?.sentAt === 'string' ? new Date(body.sentAt) : null;
    if (!title || !sentAt || isNaN(sentAt.getTime())) {
      return NextResponse.json({ message: 'sentAt and title are required' }, { status: 400 });
    }
    const res = await prisma.schoolNotification.deleteMany({ where: { ...SENT_HERE, createdAt: sentAt, title } });
    if (res.count === 0) return NextResponse.json({ message: 'That notification was not found' }, { status: 404 });
    return NextResponse.json({ recalled: res.count });
  } catch (err) {
    console.error('DELETE school-notifications failed:', err);
    return NextResponse.json({ message: 'Failed to recall notification' }, { status: 500 });
  }
}
