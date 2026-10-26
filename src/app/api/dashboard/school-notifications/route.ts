// School notifications are switched off for now. To bring them back, remove the "// " prefix below.
// import { NextResponse } from 'next/server';
// import { prisma } from '@/lib/prisma';
// import { requireAdmin } from '@/lib/auth-guard';
// import { notifySchools } from '@/lib/schoolNotifications';
// import { isPanelLink, NOTIFICATION_LIMITS } from '@/lib/schoolNotificationConfig';
//
// export const dynamic = 'force-dynamic';
//
// // POST /api/dashboard/school-notifications
// //   { title, message, link?, target: { mode: 'ALL' } | { mode: 'STATE', states: string[] } | { mode: 'SCHOOLS', schoolIds: string[] /* school codes */ } }
// // Puts one notification in the bell of every active school the target reaches.
// export async function POST(request: Request) {
//   const { payload, error } = await requireAdmin(request, 'schools.view');
//   if (error) return error;
//   try {
//     const body = await request.json().catch(() => ({}));
//     const title = typeof body?.title === 'string' ? body.title.trim() : '';
//     const message = typeof body?.message === 'string' ? body.message.trim() : '';
//     if (!title || !message) return NextResponse.json({ message: 'Title and message are required' }, { status: 400 });
//     if (title.length > NOTIFICATION_LIMITS.title) return NextResponse.json({ message: `Title can be at most ${NOTIFICATION_LIMITS.title} characters` }, { status: 400 });
//     if (message.length > NOTIFICATION_LIMITS.message) return NextResponse.json({ message: `Message can be at most ${NOTIFICATION_LIMITS.message} characters` }, { status: 400 });
//     const link = body?.link ? (isPanelLink(body.link) ? body.link : null) : null;
//     if (body?.link && !link) return NextResponse.json({ message: 'Link must be a School Panel page like /school/passports' }, { status: 400 });
//
//     const mode = body?.target?.mode;
//     const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !!x.trim()) : []);
//     let where: Record<string, any> = { isActive: true };
//     if (mode === 'STATE') {
//       const states = strings(body.target.states);
//       if (states.length === 0) return NextResponse.json({ message: 'Pick at least one state' }, { status: 400 });
//       where = { ...where, state: { in: states } };
//     } else if (mode === 'SCHOOLS') {
//       const codes = strings(body.target.schoolIds);
//       if (codes.length === 0) return NextResponse.json({ message: 'Pick at least one school' }, { status: 400 });
//       where = { ...where, schoolId: { in: codes } };
//     } else if (mode !== 'ALL') {
//       return NextResponse.json({ message: 'Invalid target' }, { status: 400 });
//     }
//
//     const schools = await prisma.school.findMany({ where, select: { id: true } });
//     if (schools.length === 0) return NextResponse.json({ message: 'No active schools match that target' }, { status: 400 });
//
//     const sent = await notifySchools(schools.map(s => s.id), { type: 'ANNOUNCEMENT', title, message, link, createdBy: payload?.id ?? null });
//     if (sent === 0) return NextResponse.json({ message: 'Could not send the notification' }, { status: 500 });
//     return NextResponse.json({ sent });
//   } catch (err) {
//     console.error('POST school-notifications failed:', err);
//     return NextResponse.json({ message: 'Failed to send notification' }, { status: 500 });
//   }
// }
//
// // GET -> recent announcements SuperAdmin sent, one entry per broadcast (rows
// // created together share a createdAt), with how many schools got it and read it.
// export async function GET(request: Request) {
//   const { error } = await requireAdmin(request, 'schools.view');
//   if (error) return error;
//   try {
//     const rows = await prisma.schoolNotification.findMany({
//       where: { type: 'ANNOUNCEMENT' },
//       orderBy: { createdAt: 'desc' },
//       take: 2000,
//       select: { title: true, message: true, link: true, createdAt: true, readAt: true },
//     });
//     const groups = new Map<string, { title: string; message: string; link: string | null; sentAt: Date; recipients: number; read: number }>();
//     for (const r of rows) {
//       const key = `${r.createdAt.getTime()}|${r.title}`;
//       const g = groups.get(key) ?? { title: r.title, message: r.message, link: r.link, sentAt: r.createdAt, recipients: 0, read: 0 };
//       g.recipients += 1;
//       if (r.readAt) g.read += 1;
//       groups.set(key, g);
//     }
//     return NextResponse.json({ history: Array.from(groups.values()).slice(0, 30) });
//   } catch (err) {
//     console.error('GET school-notifications failed:', err);
//     return NextResponse.json({ history: [] });
//   }
// }
//
export {};
